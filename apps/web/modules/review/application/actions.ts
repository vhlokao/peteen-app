"use server"

/**
 * Módulo: review
 * Camada: application (Server Actions)
 *
 * Este módulo fecha o loop de confiança do Peteen.
 * A review é o único ponto onde o tutor fala sobre o profissional.
 * Por isso, a lógica de validação aqui é a mais densa do sistema.
 *
 * Sequência de verificações em createReviewAction():
 *   1. Autenticação
 *   2. TutorProfile (identidade de domínio)
 *   3. ServiceRequest existe
 *   4. Status = COMPLETED (pré-condição de negócio)
 *   5. Ownership: tutor é o autor do request
 *   6. Self-review: tutor ≠ profissional (antifraude)
 *   7. Janela de tempo: request concluído há ≤ 30 dias (antifraude)
 *   8. Unicidade: review ainda não existe para este request (antifraude)
 *   9. Rate limiting: ≤ 5 reviews em 24h (antifraude)
 *  10. Validação Zod do input (formato + regras cross-field)
 *  11. Captura do PetContext snapshot (imutabilidade reputacional)
 *  12. Montagem do TrustEventContext (dados para futuros sistemas)
 *  13. Criação atômica: review + TrustEvent na mesma transação
 *
 * 13 verificações antes de escrever uma linha no banco.
 * Cada uma protege uma invariante diferente.
 */

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/modules/identity/application/get-session"
import { updateProfessionalTrust } from "@/modules/trust-engine/application/update-professional-trust"
import { updateRelationship } from "@/modules/relationship/application/update-relationship"
import {
  findTutorProfileByUserId,
  findPetById,
  buildPetContextSnapshot,
} from "@/modules/tutor/infrastructure/repository"
import {
  findProfessionalProfileById,
} from "@/modules/professional/infrastructure/repository"
import {
  findRequestWithOwnershipContext,
  findServiceRequestWithParticipants,
  countCompletedRequestsBetween,
} from "@/modules/service-request/infrastructure/repository"
import {
  CreateReviewSchema,
  getTrustMappingForRating,
  REVIEW_LIMITS,
  type ActionResult,
  type ReviewData,
  type ReviewWithContext,
  type ReviewSummary,
  type CreateReviewInput,
} from "../domain/types"
import {
  createReviewWithTrustEvent,
  findReviewByRequestId,
  findReviewById,
  findPublicReviewsForProfessional,
  findMyReviewsAsTutor,
  countRecentReviewsByTutor,
  countRecentReviewsForProfessional,
  getReviewSummaryForProfessional,
} from "../infrastructure/repository"
import { ANTIFRAUD_GUARDRAILS } from "@/modules/antifraude/domain/constants"

// ─────────────────────────────────────────────────────────────────────────────
// CRIAÇÃO — ação principal
// ─────────────────────────────────────────────────────────────────────────────

export async function createReviewAction(
  input: CreateReviewInput
): Promise<ActionResult<ReviewData>> {
  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const session = await requireAuth()

    // ── 2. Identidade de domínio ─────────────────────────────────────────────
    const tutorProfile = await findTutorProfileByUserId(session.id)
    if (!tutorProfile) {
      return {
        success: false,
        error: "Apenas tutores podem criar avaliações.",
      }
    }

    // ── 2b. Rate limiting: máx 20 reviews por dia por tutor ──────────────────
    const { countTodayReviews, createFlag } = await import(
      "@/modules/moderation/infrastructure/repository"
    )
    const { RATE_LIMITS } = await import("@/modules/moderation/domain/types")
    const todayReviews = await countTodayReviews(tutorProfile.id)
    if (todayReviews >= RATE_LIMITS.REVIEWS_PER_DAY) {
      await createFlag({
        targetType: "USER",
        targetId:   session.id,
        reason:     `Rate limit de reviews excedido: ${todayReviews} em 1 dia`,
        severity:   "MEDIUM",
        source:     "SYSTEM",
      }).catch(() => null)
      return {
        success: false,
        error:   `Limite diário de ${RATE_LIMITS.REVIEWS_PER_DAY} avaliações atingido.`,
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── 3. ServiceRequest existe ─────────────────────────────────────────────
    const ctx = await findRequestWithOwnershipContext(input.requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, tutorUserId, professionalUserId } = ctx

    // ── 4. Status = COMPLETED ────────────────────────────────────────────────
    // A review só pode existir após o atendimento ser formalmente concluído.
    // DISPUTED está explicitamente bloqueado aqui também (ver arquitetura de disputas).
    if (request.status !== "COMPLETED") {
      return {
        success: false,
        error:
          request.status === "DISPUTED"
            ? "Não é possível avaliar uma solicitação em disputa."
            : `Apenas solicitações concluídas podem ser avaliadas. Status atual: ${request.status}.`,
      }
    }

    // ── 5. Ownership: tutor é o autor do request ─────────────────────────────
    if (tutorUserId !== session.id) {
      return {
        success: false,
        error: "Você não é o tutor desta solicitação.",
      }
    }

    // ── 6. Self-review: tutor ≠ profissional ────────────────────────────────
    // Garante que uma pessoa não avalia a si mesma com duas personas.
    // Caso raro mas possível com contas multi-persona.
    if (tutorUserId === professionalUserId) {
      return {
        success: false,
        error: "Não é permitido avaliar um atendimento em que você é o próprio profissional.",
      }
    }

    // ── 7. Janela de tempo: completedAt ≤ 30 dias ───────────────────────────
    // Impede "revenge reviews" meses após o atendimento.
    // A memória reputacional deve ser recente para ser válida.
    if (request.completedAt) {
      const daysSinceCompletion =
        (Date.now() - request.completedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceCompletion > REVIEW_LIMITS.MAX_DAYS_AFTER_COMPLETION) {
        return {
          success: false,
          error: `Avaliações só podem ser feitas até ${REVIEW_LIMITS.MAX_DAYS_AFTER_COMPLETION} dias após a conclusão do atendimento.`,
        }
      }
    }

    // ── 8. Unicidade: review ainda não existe ───────────────────────────────
    // @unique no schema garante no banco, mas verificamos antes para melhor UX.
    const existingReview = await findReviewByRequestId(input.requestId)
    if (existingReview) {
      return {
        success: false,
        error: "Este atendimento já foi avaliado.",
      }
    }

    // ── 9. Rate limiting: ≤ 5 reviews em 24h ────────────────────────────────
    // Impede campanhas coordenadas de reviews em massa.
    const recentCount = await countRecentReviewsByTutor(tutorProfile.id, 24)
    if (recentCount >= REVIEW_LIMITS.MAX_REVIEWS_PER_DAY) {
      return {
        success: false,
        error: `Você atingiu o limite de ${REVIEW_LIMITS.MAX_REVIEWS_PER_DAY} avaliações por dia. Tente novamente amanhã.`,
      }
    }

    // ── 9b. Rate limiting por profissional: ≤ 20 reviews recebidas em 24h ───
    // Proteção contra review bombing coordenado: múltiplas contas avaliando
    // o mesmo profissional em curto período para inflar artificialmente o score.
    const receivedRecently = await countRecentReviewsForProfessional(
      request.professionalId,
      24
    )
    if (receivedRecently >= ANTIFRAUD_GUARDRAILS.MAX_REVIEWS_RECEIVED_PER_PROFESSIONAL_24H) {
      return {
        success: false,
        error:
          "Este profissional recebeu muitas avaliações recentemente. Tente novamente mais tarde.",
      }
    }

    // ── 10. Validação do input ───────────────────────────────────────────────
    const parsed = CreateReviewSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    // ── 11. PetContext snapshot ──────────────────────────────────────────────
    // Captura o estado atual do pet e o congela para sempre nesta review.
    // Se o tutor atualizar dados do pet depois, esta review permanece inalterada.
    // É a garantia de que a reputação contextual é auditável e imutável.
    if (!request.petId) {
      return {
        success: false,
        error: "Solicitação sem pet vinculado. Não é possível criar a avaliação.",
      }
    }
    const pet = await findPetById(request.petId)
    if (!pet) {
      return {
        success: false,
        error: "Dados do pet não encontrados. Não é possível criar a avaliação.",
      }
    }
    const petContext = buildPetContextSnapshot(pet)

    // ── 12. TrustEventContext ────────────────────────────────────────────────
    // Monta o contexto rico que será persistido no TrustEvent.
    // Contém todos os dados que os sistemas futuros precisam sem query adicional.
    const totalServices = await countCompletedRequestsBetween(
      request.tutorId,
      request.professionalId
    )

    const trustMapping = getTrustMappingForRating(parsed.data.rating)

    const trustEventContext = {
      reviewId: "",           // será preenchido retroativamente na transação
      rating: parsed.data.rating,
      serviceType: request.serviceType,
      petSpecies: pet.species,
      petBreed: pet.breed,
      petHasSpecialNeeds: pet.hasSpecialNeeds,
      isRecurringRelationship: request.isRecurring || totalServices > 1,
      totalServicesInRelationship: totalServices,
    }

    // ── 13. Criação atômica ──────────────────────────────────────────────────
    // Review + TrustEvent em uma única transação.
    const review = await createReviewWithTrustEvent({
      tutorId: tutorProfile.id,
      requestId: parsed.data.requestId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      serviceType: request.serviceType,
      petContext,
      trustEvent: {
        actorId: session.id,            // User.id do tutor (quem fez a avaliação)
        targetId: professionalUserId,   // User.id do profissional (quem recebe o impacto)
        type: trustMapping.type,
        weight: trustMapping.weight,
        context: trustEventContext,
        relatedRequestId: input.requestId,
      },
    })

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/(discovery)/professionals")
    revalidatePath(`/(discovery)/professionals/${request.professionalId}`)
    revalidatePath(`/tutor/requests/${input.requestId}`)

    // Atualiza relacionamento ANTES do Trust Score:
    // a review fortalece o vínculo (reviewsGiven +1) e o Trust Engine consome isso
    await updateRelationship(tutorProfile.id, request.professionalId, {
      type: "REVIEW_GIVEN",
    })

    // Recalcula e persiste Trust Score do profissional (falha silenciosa)
    await updateProfessionalTrust(request.professionalId)

    return { success: true, data: review }
  } catch (err) {
    // Captura violação de unique constraint (review duplicada em race condition)
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint failed") &&
      err.message.includes("requestId")
    ) {
      return { success: false, error: "Este atendimento já foi avaliado." }
    }
    console.error("[createReviewAction]", err)
    return { success: false, error: "Erro interno ao criar avaliação." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA — tutor (autenticado)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna as reviews criadas pelo tutor autenticado.
 */
export async function getMyReviewsAction(options?: {
  limit?: number
  offset?: number
}): Promise<ActionResult<ReviewData[]>> {
  try {
    const session = await requireAuth()

    const tutorProfile = await findTutorProfileByUserId(session.id)
    if (!tutorProfile) return { success: true, data: [] }

    const reviews = await findMyReviewsAsTutor(tutorProfile.id, options)
    return { success: true, data: reviews }
  } catch (err) {
    console.error("[getMyReviewsAction]", err)
    return { success: false, error: "Erro ao buscar avaliações." }
  }
}

/**
 * Retorna a review de um ServiceRequest específico.
 * Verifica que o usuário é participante do request.
 */
export async function getReviewForRequestAction(
  requestId: string
): Promise<ActionResult<ReviewData | null>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) return { success: false, error: "Solicitação não encontrada." }

    if (ctx.tutorUserId !== session.id && ctx.professionalUserId !== session.id) {
      return { success: false, error: "Acesso negado." }
    }

    const review = await findReviewByRequestId(requestId)
    return { success: true, data: review }
  } catch (err) {
    console.error("[getReviewForRequestAction]", err)
    return { success: false, error: "Erro ao buscar avaliação." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA — público (sem autenticação)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna reviews públicas de um profissional.
 * Apenas reviews visíveis e não flagged.
 *
 * Trust Graph (Fase 4):
 *   Cada ReviewWithContext é um nó de evidência do grafo.
 *   `isRecurringRelationship` e `totalServicesInRelationship` amplificam o peso da aresta.
 */
export async function getPublicReviewsForProfessionalAction(
  professionalId: string,
  options?: { limit?: number; offset?: number }
): Promise<ActionResult<ReviewWithContext[]>> {
  try {
    const reviews = await findPublicReviewsForProfessional(
      professionalId,
      options
    )
    return { success: true, data: reviews }
  } catch (err) {
    console.error("[getPublicReviewsForProfessionalAction]", err)
    return { success: false, error: "Erro ao buscar avaliações." }
  }
}

/**
 * Retorna o resumo agregado de reviews de um profissional.
 *
 * Ranking Engine (Fase 4):
 *   `averageByServiceType` e `averageBySpecies` são os inputs do ranking contextual.
 *   O Ranking Engine combina estes dados com trustScore e localização para ordenar resultados.
 */
export async function getReviewSummaryAction(
  professionalId: string
): Promise<ActionResult<Omit<ReviewSummary, "recentReviews">>> {
  try {
    const summary = await getReviewSummaryForProfessional(professionalId)
    return { success: true, data: summary }
  } catch (err) {
    console.error("[getReviewSummaryAction]", err)
    return { success: false, error: "Erro ao buscar resumo de avaliações." }
  }
}
