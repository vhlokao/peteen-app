/**
 * Módulo: review
 * Camada: infrastructure
 *
 * Responsabilidade: I/O com o banco via Prisma.
 *
 * Garantia central: `createReviewWithTrustEvent()` é atômica.
 * Review + TrustEvent ocorrem na mesma transação ou nenhum dos dois.
 * Nunca haverá TrustEvent sem review, nem review sem TrustEvent.
 *
 * Funções de antifraude:
 *   - `countRecentReviewsByTutor()`: rate limiting por período
 *   - `findReviewByRequestId()`: verificação de unicidade antes de criar
 *
 * Funções para sistemas futuros:
 *   - `getReviewSummaryForProfessional()`: agrega scores para Ranking Engine
 *   - `findReviewsWithContext()`: payload para Trust Graph
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { ServiceType, TrustLevel } from "@/modules/professional/domain/types"
import type { Species, PetContextSnapshot } from "@/modules/tutor/domain/types"
import type {
  ReviewData,
  ReviewWithContext,
  ReviewSummary,
  ReviewTrustEventContext,
} from "../domain/types"
import type { TrustEventType } from "@/modules/service-request/domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// CRIAÇÃO — operação central, sempre atômica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria uma review e emite o TrustEvent correspondente em uma transação.
 *
 * Garantia de integridade:
 *   Se o TrustEvent falhar, a review não é criada.
 *   Se a review falhar, o TrustEvent não é criado.
 *   Não existe review sem evidência reputacional.
 *   Não existe TrustEvent sem a review que o justifica.
 */
export async function createReviewWithTrustEvent(data: {
  tutorId: string
  requestId: string
  rating: number
  comment?: string
  serviceType: ServiceType
  petContext: PetContextSnapshot
  trustEvent: {
    actorId: string
    targetId: string
    type: TrustEventType
    weight: number
    context: ReviewTrustEventContext
    relatedRequestId: string
    relatedReviewId?: string
  }
}): Promise<ReviewData> {
  return prisma.$transaction(async (tx) => {
    // 1. Cria a review
    const review = await tx.review.create({
      data: {
        tutorId: data.tutorId,
        requestId: data.requestId,
        rating: data.rating,
        comment: data.comment ?? null,
        serviceType: data.serviceType,
        petContext: data.petContext as unknown as Prisma.InputJsonValue,
        isVisible: true,
        isFlagged: false,
      },
    })

    // 2. Emite TrustEvent com relatedReviewId preenchido
    await tx.trustEvent.create({
      data: {
        actorId: data.trustEvent.actorId,
        targetId: data.trustEvent.targetId,
        type: data.trustEvent.type,
        weight: data.trustEvent.weight,
        context: {
          ...data.trustEvent.context,
          relatedReviewId: review.id, // retroalimenta o contexto com o ID real da review
        } as Prisma.InputJsonValue,
        relatedRequestId: data.trustEvent.relatedRequestId,
        relatedReviewId: review.id,
        isFlagged: false,
      },
    })

    return mapToDomain(review, data.petContext)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA
// ─────────────────────────────────────────────────────────────────────────────

export async function findReviewByRequestId(
  requestId: string
): Promise<ReviewData | null> {
  const result = await prisma.review.findUnique({
    where: { requestId },
  })
  return result ? mapToDomainRaw(result) : null
}

export async function findReviewById(id: string): Promise<ReviewData | null> {
  const result = await prisma.review.findUnique({ where: { id } })
  return result ? mapToDomainRaw(result) : null
}

/**
 * Reviews de um profissional para exibição no perfil público.
 * Apenas reviews visíveis e não flagged (moderadas).
 *
 * Trust Graph (Fase 4):
 *   Esta query retorna os "nós de evidência" do grafo de confiança.
 *   Cada review é uma aresta: tutor → profissional com peso = rating.
 *   O campo `isRecurringRelationship` amplifica o peso da aresta.
 */
export async function findPublicReviewsForProfessional(
  professionalId: string,
  options?: { limit?: number; offset?: number }
): Promise<ReviewWithContext[]> {
  const results = await prisma.review.findMany({
    where: {
      isVisible: true,
      isFlagged: false,
      request: {
        professionalId,
      },
    },
    include: {
      tutor: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      request: {
        select: {
          isRecurring: true,
          seriesId: true,
          tutorId: true,
          professionalId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  })

  // Para cada review, conta atendimentos concluídos na relação
  // para determinar se é uma relação recorrente (peso maior no Trust Graph)
  const reviewsWithContext = await Promise.all(
    results.map(async (r) => {
      const totalServices = await prisma.serviceRequest.count({
        where: {
          tutorId: r.request.tutorId,
          professionalId: r.request.professionalId,
          status: "COMPLETED",
        },
      })

      return {
        ...mapToDomainRaw(r),
        tutor: r.tutor,
        isRecurringRelationship: r.request.isRecurring || totalServices > 1,
        totalServicesInRelationship: totalServices,
      } satisfies ReviewWithContext
    })
  )

  return reviewsWithContext
}

export async function findMyReviewsAsTutor(
  tutorId: string,
  options?: { limit?: number; offset?: number }
): Promise<ReviewData[]> {
  const results = await prisma.review.findMany({
    where: { tutorId },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  })
  return results.map(mapToDomainRaw)
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTIFRAUDE — rate limiting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conta reviews criadas pelo tutor nas últimas `windowHours` horas.
 * Usado para rate limiting: impede criação massiva de reviews em curto período.
 *
 * Antifraude (Fase 4):
 *   Um tutor que cria N reviews em X horas para o MESMO profissional
 *   é um sinal forte de manipulação de ranking.
 *   O módulo antifraude da Fase 4 lerá esta query e emitirá FraudSignal.
 */
export async function countRecentReviewsByTutor(
  tutorId: string,
  windowHours: number = 24
): Promise<number> {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000)
  return prisma.review.count({
    where: {
      tutorId,
      createdAt: { gte: windowStart },
    },
  })
}

/**
 * Conta reviews que um tutor específico já fez para um profissional específico.
 * Idealmente deve ser 1 (uma review por atendimento).
 * Usado para detectar padrões de review em série para o mesmo profissional.
 */
export async function countReviewsBetween(
  tutorId: string,
  professionalId: string
): Promise<number> {
  return prisma.review.count({
    where: {
      tutorId,
      request: { professionalId },
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// AGREGAÇÃO — para Ranking Engine e perfil público
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrega métricas de reviews para o perfil público de um profissional.
 *
 * Ranking Engine (Fase 4):
 *   `averageByServiceType` permite que o Ranking Engine pontue profissionais
 *   de forma contextual. Um profissional com 4.9 em DOG_WALK e 3.2 em GROOMING
 *   aparece acima de um com 4.0 em ambos, quando o tutor busca DOG_WALK.
 *
 *   `averageBySpecies` permite ranking contextual por tipo de animal:
 *   profissional especializado em gatos aparece primeiro para tutores com gatos.
 */
export async function getReviewSummaryForProfessional(
  professionalId: string
): Promise<Omit<ReviewSummary, "recentReviews">> {
  const reviews = await prisma.review.findMany({
    where: {
      isVisible: true,
      isFlagged: false,
      request: { professionalId },
    },
    select: {
      rating: true,
      serviceType: true,
      petContext: true,
    },
  })

  if (reviews.length === 0) {
    return {
      professionalId,
      totalReviews: 0,
      averageRating: 0,
      averageByServiceType: {},
      averageBySpecies: {},
    }
  }

  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0)
  const averageRating = totalRating / reviews.length

  // Agrega por serviceType
  const byServiceType: Record<string, { sum: number; count: number }> = {}
  const bySpecies: Record<string, { sum: number; count: number }> = {}

  for (const r of reviews) {
    // Por serviceType
    const stEntry = byServiceType[r.serviceType] ?? { sum: 0, count: 0 }
    stEntry.sum += r.rating
    stEntry.count++
    byServiceType[r.serviceType] = stEntry

    // Por espécie — extraído do petContext (snapshot imutável)
    const ctx = r.petContext as unknown as PetContextSnapshot
    if (ctx?.species) {
      const spEntry = bySpecies[ctx.species] ?? { sum: 0, count: 0 }
      spEntry.sum += r.rating
      spEntry.count++
      bySpecies[ctx.species] = spEntry
    }
  }

  const averageByServiceType: Partial<Record<ServiceType, { count: number; average: number }>> = {}
  for (const [type, data] of Object.entries(byServiceType)) {
    averageByServiceType[type as ServiceType] = {
      count: data.count,
      average: data.sum / data.count,
    }
  }

  const averageBySpecies: Partial<Record<Species, { count: number; average: number }>> = {}
  for (const [species, data] of Object.entries(bySpecies)) {
    averageBySpecies[species as Species] = {
      count: data.count,
      average: data.sum / data.count,
    }
  }

  return {
    professionalId,
    totalReviews: reviews.length,
    averageRating,
    averageByServiceType,
    averageBySpecies,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function mapToDomainRaw(record: {
  id: string
  tutorId: string
  requestId: string
  rating: number
  comment: string | null
  serviceType: string
  petContext: Prisma.JsonValue
  isVisible: boolean
  isFlagged: boolean
  flagReason: string | null
  flaggedAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): ReviewData {
  return {
    id: record.id,
    tutorId: record.tutorId,
    requestId: record.requestId,
    rating: record.rating,
    comment: record.comment,
    serviceType: record.serviceType as ServiceType,
    petContext: record.petContext as unknown as PetContextSnapshot,
    isVisible: record.isVisible,
    isFlagged: record.isFlagged,
    flagReason: record.flagReason,
    flaggedAt: record.flaggedAt,
    resolvedAt: record.resolvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function mapToDomain(
  record: {
    id: string
    tutorId: string
    requestId: string
    rating: number
    comment: string | null
    serviceType: string
    isVisible: boolean
    isFlagged: boolean
    flagReason: string | null
    flaggedAt: Date | null
    resolvedAt: Date | null
    createdAt: Date
    updatedAt: Date
  },
  petContext: PetContextSnapshot
): ReviewData {
  return {
    id: record.id,
    tutorId: record.tutorId,
    requestId: record.requestId,
    rating: record.rating,
    comment: record.comment,
    serviceType: record.serviceType as ServiceType,
    petContext,
    isVisible: record.isVisible,
    isFlagged: record.isFlagged,
    flagReason: record.flagReason,
    flaggedAt: record.flaggedAt,
    resolvedAt: record.resolvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
