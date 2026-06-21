"use server"

/**
 * Módulo: service-request
 * Camada: application (Server Actions)
 *
 * Este arquivo orquestra o core transacional do Peteen.
 * Toda transição de estado de um ServiceRequest passa por aqui.
 *
 * Padrão de autorização em três camadas:
 *   1. Autenticação: requireAuth() — usuário tem sessão válida?
 *   2. Identidade de domínio: tem TutorProfile OU ProfessionalProfile?
 *   3. Ownership: o perfil de domínio corresponde ao request?
 *
 * Padrão de transição de estado:
 *   1. Carrega request + contexto de ownership (uma query)
 *   2. Verifica se a transição é válida via VALID_TRANSITIONS (dados)
 *   3. Verifica se o ator é autorizado via TRANSITION_ACTOR (dados)
 *   4. Identifica TrustEvent via TRANSITION_TRUST_EVENTS (dados)
 *   5. Chama transitionStatus() — operação atômica
 *
 * Toda lógica de "quem pode fazer o quê" está nos dados do domínio,
 * não em condicionais espalhadas aqui.
 */

import { revalidatePath } from "next/cache"
import { updateProfessionalTrust } from "@/modules/trust-engine/application/update-professional-trust"
import { updateRelationship } from "@/modules/relationship/application/update-relationship"
import { requireAuth } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { findProfessionalProfileByUserId } from "@/modules/professional/infrastructure/repository"
import {
  isValidTransition,
  getAuthorizedActor,
  getTrustEventForTransition,
  CreateServiceRequestSchema,
  CancelServiceRequestSchema,
  CompleteServiceRequestSchema,
  type ActionResult,
  type ServiceRequestData,
  type ServiceRequestWithParticipants,
  type RequestStatus,
  type TrustEventPayload,
} from "../domain/types"
import {
  createServiceRequestRecord,
  findServiceRequestById,
  findServiceRequestWithParticipants,
  findServiceRequestsByTutorId,
  findServiceRequestsByProfessionalId,
  findRequestWithOwnershipContext,
  transitionStatus,
  countCompletedRequestsBetween,
  hasPendingRequestsForPet,
} from "../infrastructure/repository"

// ─────────────────────────────────────────────────────────────────────────────
// CRIAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria uma solicitação de serviço.
 *
 * Invariantes:
 *   - Apenas tutores podem criar requests
 *   - O pet deve pertencer ao tutor autenticado
 *   - A data agendada deve ser no futuro
 *   - Se isRecurring e parentRequestId: valida que o parent existe e foi COMPLETED
 *   - Se isRecurring sem parentRequestId: gera um novo seriesId automaticamente
 *
 * Recorrência (Fase 3):
 *   - O seriesId é gerado aqui se não fornecido (primeiro da série)
 *   - Os campos de recorrência são armazenados mas NÃO processados automaticamente
 *   - O próximo request da série é criado manualmente (Fase 3) ou por automação (Fase 4)
 */
export async function createServiceRequestAction(
  input: import("../domain/types").CreateServiceRequestInput
): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const tutorProfile = await findTutorProfileByUserId(session.id)
    if (!tutorProfile) {
      return {
        success: false,
        error: "Complete o perfil de tutor antes de solicitar um serviço.",
      }
    }

    // ── Rate limiting: máx 10 solicitações por dia por tutor ──────────────────
    const { countTodayServiceRequests } = await import(
      "@/modules/moderation/infrastructure/repository"
    )
    const { RATE_LIMITS } = await import("@/modules/moderation/domain/types")
    const todayCount = await countTodayServiceRequests(tutorProfile.id)
    if (todayCount >= RATE_LIMITS.SERVICE_REQUESTS_PER_DAY) {
      // Cria flag automática de sistema e rejeita a solicitação
      const { createFlag } = await import(
        "@/modules/moderation/infrastructure/repository"
      )
      await createFlag({
        targetType: "USER",
        targetId:   session.id,
        reason:     `Rate limit excedido: ${todayCount} solicitações em 1 dia`,
        severity:   "MEDIUM",
        source:     "SYSTEM",
      }).catch(() => null)
      return {
        success: false,
        error:   `Limite diário de ${RATE_LIMITS.SERVICE_REQUESTS_PER_DAY} solicitações atingido. Tente novamente amanhã.`,
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const parsed = CreateServiceRequestSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    // Ownership: o pet deve pertencer ao tutor autenticado
    const { findPetByIdAndTutorId } = await import(
      "@/modules/tutor/infrastructure/repository"
    )
    const pet = await findPetByIdAndTutorId(parsed.data.petId, tutorProfile.id)
    if (!pet) {
      return { success: false, error: "Pet não encontrado ou não pertence a você." }
    }

    // Recorrência: valida parentRequestId se fornecido
    if (parsed.data.parentRequestId) {
      const parentRequest = await findServiceRequestById(parsed.data.parentRequestId)
      if (!parentRequest) {
        return { success: false, error: "Request pai não encontrado." }
      }
      if (parentRequest.status !== "COMPLETED") {
        return {
          success: false,
          error: "Request pai deve estar concluído para criar um novo na série.",
        }
      }
      if (parentRequest.tutorId !== tutorProfile.id) {
        return { success: false, error: "Request pai não pertence ao seu perfil." }
      }
    }

    // Recorrência: gera seriesId se isRecurring e não fornecido
    let seriesId = parsed.data.seriesId
    if (parsed.data.isRecurring && !seriesId) {
      // Novo série — gera um ID único para agrupar futuros requests
      // Formato: sr-{requestId será gerado} — usamos timestamp + random como seed
      seriesId = `series-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    }

    const request = await createServiceRequestRecord({
      tutorId: tutorProfile.id,
      professionalId: parsed.data.professionalId,
      petId: parsed.data.petId,
      serviceType: parsed.data.serviceType,
      scheduledAt: parsed.data.scheduledAt,
      notes: parsed.data.notes,
      isRecurring: parsed.data.isRecurring,
      parentRequestId: parsed.data.parentRequestId,
      seriesId,
      recurrenceRule: parsed.data.recurrenceRule,
      recurrenceEndsAt: parsed.data.recurrenceEndsAt,
    })

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")

    return { success: true, data: request }
  } catch (err) {
    console.error("[createServiceRequestAction]", err)
    return { success: false, error: "Erro interno ao criar solicitação." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSIÇÕES DE STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aceita uma solicitação. Apenas profissionais. PENDING → ACCEPTED.
 */
export async function acceptServiceRequestAction(
  requestId: string
): Promise<ActionResult<ServiceRequestData>> {
  return applyTransition({
    requestId,
    toStatus: "ACCEPTED",
    requiredActor: "professional",
  })
}

/**
 * Rejeita uma solicitação. Apenas profissionais. PENDING → CANCELLED_BY_PROFESSIONAL.
 *
 * Trust impact: CANCELLATION_BY_PRO (-2.0)
 * Semântica: "rejeição" é uma recusa antes de assumir o compromisso.
 * Impacto menor que cancelar após aceitar.
 */
export async function rejectServiceRequestAction(
  requestId: string
): Promise<ActionResult<ServiceRequestData>> {
  return applyTransition({
    requestId,
    toStatus: "CANCELLED_BY_PROFESSIONAL",
    requiredActor: "professional",
  })
}

/**
 * Inicia o atendimento. Apenas profissionais. ACCEPTED → IN_PROGRESS.
 */
export async function startServiceRequestAction(
  requestId: string
): Promise<ActionResult<ServiceRequestData>> {
  return applyTransition({
    requestId,
    toStatus: "IN_PROGRESS",
    requiredActor: "professional",
  })
}

/**
 * Cancela uma solicitação.
 *
 * O estado de destino depende de quem cancela:
 *   - Tutor → CANCELLED_BY_TUTOR
 *   - Profissional → CANCELLED_BY_PROFESSIONAL (com impacto no trust se ACCEPTED)
 *
 * Estados que permitem cancelamento: PENDING, ACCEPTED.
 */
export async function cancelServiceRequestAction(
  requestId: string,
  input?: import("../domain/types").CancelServiceRequestInput
): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, tutorUserId, professionalUserId } = ctx

    // Determina quem está cancelando
    const isTutor = tutorUserId === session.id
    const isProfessional = professionalUserId === session.id

    if (!isTutor && !isProfessional) {
      return { success: false, error: "Você não é participante desta solicitação." }
    }

    const toStatus: RequestStatus = isTutor
      ? "CANCELLED_BY_TUTOR"
      : "CANCELLED_BY_PROFESSIONAL"

    // Valida transição via máquina de estados
    if (!isValidTransition(request.status, toStatus)) {
      return {
        success: false,
        error: `Não é possível cancelar uma solicitação com status "${request.status}".`,
      }
    }

    // Verifica autorização da transição específica
    const authorizedActor = getAuthorizedActor(request.status, toStatus)
    const actorRole = isTutor ? "tutor" : "professional"
    if (authorizedActor !== actorRole && authorizedActor !== "either") {
      return { success: false, error: "Você não tem permissão para esta ação." }
    }

    // TrustEvent se houver
    const trustEventDef = getTrustEventForTransition(request.status, toStatus)
    const trustEvent: TrustEventPayload | undefined = trustEventDef
      ? {
          actorId: professionalUserId, // o profissional sempre é o ator do cancelamento próprio
          targetId: professionalUserId, // e o alvo do impacto reputacional
          type: trustEventDef.type,
          weight: trustEventDef.weight,
          context: {
            requestId,
            serviceType: request.serviceType,
            fromStatus: request.status,
            reason: input?.reason ?? null,
          },
          relatedRequestId: requestId,
        }
      : undefined

    const updated = await transitionStatus(requestId, toStatus, { trustEvent })

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")
    revalidatePath(`/tutor/requests/${requestId}`)
    revalidatePath(`/requests/${requestId}`)

    return { success: true, data: updated }
  } catch (err) {
    console.error("[cancelServiceRequestAction]", err)
    return { success: false, error: "Erro interno ao cancelar solicitação." }
  }
}

/**
 * Conclui um atendimento. Apenas profissionais.
 * Estados de origem permitidos: ACCEPTED, IN_PROGRESS.
 *
 * Efeitos ao concluir:
 *   1. Status → COMPLETED, completedAt = now()
 *   2. nextScheduledAt registrado (hint para CRM e sugestão de recorrência)
 *   3. Se isRecurring: emite TrustEvent RECURRENCE_COMPLETED (+1.5)
 *      — o Trust Engine acumula estes eventos para construir o score de recorrência
 *
 * Recorrência (Fase 4):
 *   - Não cria automaticamente o próximo request
 *   - O CRM Module lê completedAt + nextScheduledAt para sugerir o próximo agendamento
 *   - O Ranking Engine usa a contagem de RECURRENCE_COMPLETED para bônus contextual
 */
export async function completeServiceRequestAction(
  requestId: string,
  input?: import("../domain/types").CompleteServiceRequestInput
): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, tutorUserId, professionalUserId } = ctx

    // Apenas profissional conclui
    if (professionalUserId !== session.id) {
      return {
        success: false,
        error: "Apenas o profissional pode marcar a solicitação como concluída.",
      }
    }

    // Valida que o status atual permite conclusão
    const toStatus: RequestStatus = "COMPLETED"
    if (!isValidTransition(request.status, toStatus)) {
      return {
        success: false,
        error: `Não é possível concluir uma solicitação com status "${request.status}".`,
      }
    }

    // TrustEvent de recorrência (apenas se isRecurring com histórico)
    let trustEvent: TrustEventPayload | undefined

    if (request.isRecurring) {
      // Conta quantos atendimentos concluídos já existem entre estes dois (antes deste)
      const completedCount = await countCompletedRequestsBetween(
        request.tutorId,
        request.professionalId
      )

      // RECURRENCE_COMPLETED: o ator é o tutor (quem retornou)
      // O alvo é o profissional (quem recebe o crédito reputacional)
      // Peso base: 1.5 — pode ser amplificado pelo Trust Engine com base em completedCount
      trustEvent = {
        actorId: tutorUserId,
        targetId: professionalUserId,
        type: "RECURRENCE_COMPLETED",
        weight: 1.5,
        context: {
          requestId,
          serviceType: request.serviceType,
          seriesId: request.seriesId,
          completedCountInSeries: completedCount + 1, // inclui este
          petId: request.petId,
        },
        relatedRequestId: requestId,
      }
    }

    const parsed = CompleteServiceRequestSchema.safeParse(input ?? {})
    const nextScheduledAt = parsed.success ? parsed.data.nextScheduledAt : undefined

    const updated = await transitionStatus(requestId, toStatus, {
      trustEvent,
      nextScheduledAt,
    })

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")
    revalidatePath(`/tutor/requests/${requestId}`)
    revalidatePath(`/requests/${requestId}`)

    // Atualiza relacionamento ANTES do Trust Score:
    // o Trust Engine consome TutorProfessionalRelationship para bônus de recorrência
    await updateRelationship(request.tutorId, request.professionalId, {
      type:      "SERVICE_COMPLETED",
      serviceAt: new Date(),
    })

    // Recalcula Trust Score após conclusão (falha silenciosa)
    await updateProfessionalTrust(request.professionalId)

    return { success: true, data: updated }
  } catch (err) {
    console.error("[completeServiceRequestAction]", err)
    return { success: false, error: "Erro interno ao concluir solicitação." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna os requests do tutor autenticado, com dados dos participantes.
 */
export async function getMyRequestsAsTutorAction(filters?: {
  status?: RequestStatus
  limit?: number
  offset?: number
}): Promise<ActionResult<ServiceRequestWithParticipants[]>> {
  try {
    const session = await requireAuth()

    const tutorProfile = await findTutorProfileByUserId(session.id)
    if (!tutorProfile) return { success: true, data: [] }

    const requests = await findServiceRequestsByTutorId(tutorProfile.id, filters)
    return { success: true, data: requests }
  } catch (err) {
    console.error("[getMyRequestsAsTutorAction]", err)
    return { success: false, error: "Erro ao buscar solicitações." }
  }
}

/**
 * Retorna os requests do profissional autenticado, com dados dos participantes.
 */
export async function getMyRequestsAsProfessionalAction(filters?: {
  status?: RequestStatus
  limit?: number
  offset?: number
}): Promise<ActionResult<ServiceRequestWithParticipants[]>> {
  try {
    const session = await requireAuth()

    const professionalProfile = await findProfessionalProfileByUserId(session.id)
    if (!professionalProfile) return { success: true, data: [] }

    const requests = await findServiceRequestsByProfessionalId(
      professionalProfile.id,
      filters
    )
    return { success: true, data: requests }
  } catch (err) {
    console.error("[getMyRequestsAsProfessionalAction]", err)
    return { success: false, error: "Erro ao buscar solicitações." }
  }
}

/**
 * Retorna o detalhe de um request, verificando que o usuário é participante.
 */
export async function getServiceRequestDetailAction(
  requestId: string
): Promise<ActionResult<ServiceRequestWithParticipants>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { tutorUserId, professionalUserId } = ctx
    if (tutorUserId !== session.id && professionalUserId !== session.id) {
      return { success: false, error: "Acesso negado." }
    }

    const detail = await findServiceRequestWithParticipants(requestId)
    if (!detail) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    return { success: true, data: detail }
  } catch (err) {
    console.error("[getServiceRequestDetailAction]", err)
    return { success: false, error: "Erro ao buscar solicitação." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER INTERNO — applyTransition
//
// Centraliza o padrão de transição para ações simples (accept, reject, start)
// Reutiliza a máquina de estados para autorização + validação
// ─────────────────────────────────────────────────────────────────────────────

async function applyTransition({
  requestId,
  toStatus,
  requiredActor,
}: {
  requestId: string
  toStatus: RequestStatus
  requiredActor: "tutor" | "professional"
}): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, tutorUserId, professionalUserId } = ctx

    // Verifica ownership pelo papel requerido
    const actorUserId =
      requiredActor === "professional" ? professionalUserId : tutorUserId
    if (actorUserId !== session.id) {
      return {
        success: false,
        error:
          requiredActor === "professional"
            ? "Apenas o profissional pode realizar esta ação."
            : "Apenas o tutor pode realizar esta ação.",
      }
    }

    // Valida transição via máquina de estados (dados)
    if (!isValidTransition(request.status, toStatus)) {
      return {
        success: false,
        error: `Transição inválida: "${request.status}" → "${toStatus}".`,
      }
    }

    // Verifica ator autorizado (dados)
    const authorizedActor = getAuthorizedActor(request.status, toStatus)
    if (
      authorizedActor !== requiredActor &&
      authorizedActor !== "either"
    ) {
      return { success: false, error: "Você não tem permissão para esta transição." }
    }

    // TrustEvent se houver definição para esta transição (dados)
    const trustEventDef = getTrustEventForTransition(request.status, toStatus)
    const trustEvent: TrustEventPayload | undefined = trustEventDef
      ? {
          actorId: professionalUserId,
          targetId: professionalUserId,
          type: trustEventDef.type,
          weight: trustEventDef.weight,
          context: {
            requestId,
            serviceType: request.serviceType,
            fromStatus: request.status,
          },
          relatedRequestId: requestId,
        }
      : undefined

    const updated = await transitionStatus(requestId, toStatus, { trustEvent })

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")
    revalidatePath(`/tutor/requests/${requestId}`)
    revalidatePath(`/requests/${requestId}`)

    return { success: true, data: updated }
  } catch (err) {
    console.error(`[applyTransition ${toStatus}]`, err)
    return { success: false, error: "Erro interno ao processar a solicitação." }
  }
}
