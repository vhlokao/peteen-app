/**
 * módulo: recommendation
 * camada: application
 *
 * Motor de recomendações do Peteen — sem IA, sem ML.
 *
 * Estratégia:
 *   1. Busca todos os profissionais ativos em uma query
 *   2. Batch-fetch de completedServices, review stats e recurring clients
 *   3. Computa badges e score para cada profissional
 *   4. Agrupa em 4 blocos temáticos: for_you, top_rated, recurring, verified
 *
 * Fallback total: retorna [] em qualquer erro — nunca quebra a página.
 */

import { prisma } from "@/lib/prisma/client"
import { resolveBadges } from "@/modules/badges/domain/resolver"
import { computeRecommendationScore } from "../domain/scoring"
import { getActiveConnectionsBatch } from "@/modules/trust-graph/infrastructure/repository"
import { buildEndorsementSummary } from "@/modules/trust-graph/domain/scoring"
import type {
  RecommendationBlock,
  RecommendationContext,
  RecommendedProfessional,
  RecommendationInput,
} from "../domain/types"
import type { ServiceType, TrustLevel } from "@/modules/professional/domain/types"
import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state"

// ── Tipos internos ────────────────────────────────────────────────────────────

type ProfRow = {
  id:               string
  displayName:      string
  city:             string
  state:            string
  neighborhood:     string | null
  neighborhoodId:   string | null
  regionId:         string | null
  avatarUrl:        string | null
  trustScore:       number
  trustLevel:       string
  isVerified:       boolean
  serviceTypes:     string[]
  verifiedIdentity: boolean
  verifiedPhone:    boolean
  verifiedPartner:  boolean
}

type ReviewStat = { count: number; avg: number | null }

// ── Helpers de fetch (batch — sem N+1) ────────────────────────────────────────

async function fetchAllProfessionals(): Promise<ProfRow[]> {
  const rows = await prisma.professionalProfile.findMany({
    where: {
      deletedAt: null,
      // Mesma elegibilidade mínima do Discovery (findPublicProfessionals):
      // não recomendar quem não tem nenhuma oferta contratável. Só filtra o
      // pool de candidatos — não toca em computeRecommendationScore,
      // resolveBadges ou buildEndorsementSummary.
      services: { some: { isActive: true } },
    },
    select: {
      id:               true,
      displayName:      true,
      city:             true,
      state:            true,
      neighborhood:     true,
      neighborhoodId:   true,
      regionId:         true,
      avatarUrl:        true,
      trustScore:       true,
      trustLevel:       true,
      isVerified:       true,
      serviceTypes:     true,
      verifiedIdentity: true,
      verifiedPhone:    true,
      verifiedPartner:  true,
    },
  })
  return rows as unknown as ProfRow[]
}

async function fetchCompletedServicesMap(
  professionalIds: string[]
): Promise<Map<string, number>> {
  if (professionalIds.length === 0) return new Map()
  const rows = await prisma.serviceRequest.groupBy({
    by:    ["professionalId"],
    where: { professionalId: { in: professionalIds }, status: "COMPLETED" },
    _count: { id: true },
  })
  return new Map(rows.map((r) => [r.professionalId, r._count.id]))
}

async function fetchReviewStatsMap(
  professionalIds: string[]
): Promise<Map<string, ReviewStat>> {
  if (professionalIds.length === 0) return new Map()
  try {
    const rows = await prisma.$queryRaw<
      Array<{ professionalId: string; count: bigint; avg: number | null }>
    >`
      SELECT sr."professionalId", COUNT(r.id) AS count, AVG(r.rating) AS avg
      FROM reviews r
      JOIN service_requests sr ON sr.id = r."requestId"
      WHERE sr."professionalId" = ANY(${professionalIds})
        AND r."isVisible"     = TRUE
        AND r."hiddenByAdmin" = FALSE
      GROUP BY sr."professionalId"
    `
    return new Map(
      rows.map((row) => [
        row.professionalId,
        { count: Number(row.count), avg: row.avg ?? null },
      ])
    )
  } catch {
    return new Map()
  }
}

/**
 * fetchRecurringClientsMap — conta tutores com 3+ sessões por profissional.
 * Usa TutorProfessionalRelationship (Phase 5.3). Fallback silencioso em erro.
 */
async function fetchRecurringClientsMap(
  professionalIds: string[]
): Promise<Map<string, number>> {
  if (professionalIds.length === 0) return new Map()
  try {
    const rows = await prisma.tutorProfessionalRelationship.groupBy({
      by:    ["professionalId"],
      where: {
        professionalId:    { in: professionalIds },
        completedServices: { gte: 3 },
      },
      _count: { id: true },
    })
    return new Map(rows.map((r) => [r.professionalId, r._count.id]))
  } catch {
    return new Map()
  }
}

// ── Score builder ─────────────────────────────────────────────────────────────

function scoreAndEnrich(
  pro:              ProfRow,
  completed:        number,
  revStat:          ReviewStat,
  recurring:        number,
  context:          RecommendationContext,
  endorsements:     { partner: number; professional: number; tutor: number }
): RecommendedProfessional {
  const verificationActive = isProfessionalVerificationActive(pro)

  const { badges } = resolveBadges({
    completedServices:   completed,
    trustScore:          pro.trustScore,
    reviewCount:         revStat.count,
    averageRating:       revStat.avg,
    verifiedProfile:     verificationActive,
    verifiedIdentity:    pro.verifiedIdentity,
    verifiedPhone:       pro.verifiedPhone,
    verifiedPartner:     pro.verifiedPartner,
    partnerEndorsements: endorsements.partner,
  })

  const input: RecommendationInput = {
    professionalId:           pro.id,
    professionalCity:         pro.city,
    professionalServiceTypes: pro.serviceTypes as ServiceType[],
    trustScore:               pro.trustScore,
    isVerified:               verificationActive,
    activeBadgeCount:         badges.length,
    reviewCount:              revStat.count,
    averageRating:            revStat.avg,
    recurringClientsCount:    recurring,
    tutorCompletedServices:   context.myRelMap.get(pro.id) ?? 0,
    tutorCity:                  context.tutorCity,
    tutorNeighborhood:          context.tutorNeighborhood,
    tutorRegionId:              context.tutorRegionId,
    tutorNeighborhoodId:        context.tutorNeighborhoodId,
    professionalNeighborhood:   pro.neighborhood,
    professionalRegionId:       pro.regionId,
    professionalNeighborhoodId: pro.neighborhoodId,
    requestedServiceType:       context.requestedServiceType,
    partnerEndorsements:      endorsements.partner,
    professionalEndorsements: endorsements.professional,
    tutorEndorsements:        endorsements.tutor,
  }

  return {
    professionalId: pro.id,
    displayName:    pro.displayName,
    city:           pro.city,
    state:          pro.state,
    avatarUrl:      pro.avatarUrl,
    trustScore:     pro.trustScore,
    trustLevel:     pro.trustLevel as TrustLevel,
    isVerified:     verificationActive,
    serviceTypes:   pro.serviceTypes as ServiceType[],
    reviewCount:    revStat.count,
    averageRating:  revStat.avg,
    score:          computeRecommendationScore(input),
  }
}

// ── Fetch compartilhado ───────────────────────────────────────────────────────

async function fetchScoredProfessionals(
  context: RecommendationContext
): Promise<{ scored: RecommendedProfessional[]; recurringMap: Map<string, number> }> {
  const professionals = await fetchAllProfessionals()
  if (professionals.length === 0) return { scored: [], recurringMap: new Map() }

  const ids = professionals.map((p) => p.id)

  const [completedMap, reviewMap, recurringMap, connectionsMap] = await Promise.all([
    fetchCompletedServicesMap(ids),
    fetchReviewStatsMap(ids),
    fetchRecurringClientsMap(ids),
    getActiveConnectionsBatch(ids),
  ])

  const scored = professionals.map((pro) => {
    const connections   = connectionsMap.get(pro.id) ?? []
    const endorseSummary = buildEndorsementSummary(connections)
    return scoreAndEnrich(
      pro,
      completedMap.get(pro.id) ?? 0,
      reviewMap.get(pro.id)    ?? { count: 0, avg: null },
      recurringMap.get(pro.id) ?? 0,
      context,
      {
        partner:      endorseSummary.partnerEndorsements,
        professional: endorseSummary.professionalEndorsements,
        tutor:        endorseSummary.tutorEndorsements,
      }
    )
  })

  return { scored, recurringMap }
}

// ── API pública — Discovery ───────────────────────────────────────────────────

/**
 * getRecommendations — retorna blocos de recomendações para o Discovery.
 *
 * Blocos retornados (apenas os não-vazios):
 *   "for_you"   — top profissionais por score geral (com contexto do tutor)
 *   "top_rated" — avaliação >= 4.0 com mínimo de reviews
 *   "recurring" — profissionais com 2+ clientes recorrentes
 *   "verified"  — profissionais verificados pelo Peteen
 *
 * Fallback: retorna [] em qualquer erro — nunca quebra a página.
 */
export async function getRecommendations(
  context: RecommendationContext,
  options?: { limit?: number }
): Promise<RecommendationBlock[]> {
  const limit = options?.limit ?? 4

  try {
    const { scored, recurringMap } = await fetchScoredProfessionals(context)
    if (scored.length === 0) return []

    const byScore = [...scored].sort((a, b) => b.score.totalScore - a.score.totalScore)

    // ── for_you: top N por score (com contexto de tutor personalizado) ─────────
    const forYou = byScore.filter((p) => p.score.totalScore > 0).slice(0, limit)

    // ── top_rated: filtro por rating qualificado ───────────────────────────────
    const topRated = [...scored]
      .filter(
        (p) =>
          p.reviewCount >= 3 &&
          p.averageRating !== null &&
          p.averageRating >= 4.0
      )
      .sort((a, b) => {
        const d = (b.averageRating ?? 0) - (a.averageRating ?? 0)
        return Math.abs(d) > 0.05 ? d : b.reviewCount - a.reviewCount
      })
      .slice(0, limit)

    // ── recurring: profissionais com clientes recorrentes ─────────────────────
    const recurringBlock = [...scored]
      .filter((p) => (recurringMap.get(p.professionalId) ?? 0) >= 2)
      .sort(
        (a, b) =>
          (recurringMap.get(b.professionalId) ?? 0) -
          (recurringMap.get(a.professionalId) ?? 0)
      )
      .slice(0, limit)

    // ── verified: verificados pelo Peteen ─────────────────────────────────────
    const verifiedBlock = byScore.filter((p) => p.isVerified).slice(0, limit)

    // ── partner_endorsed: recomendados por parceiros (Etapa 5.8) ─────────────
    const partnerEndorsedBlock = byScore
      .filter((p) =>
        (p.score.factors.find((f) => f.key === "trust_graph")?.points ?? 0) > 0
      )
      .slice(0, limit)

    const allBlocks: RecommendationBlock[] = [
      {
        id:            "for_you",
        title:         "Recomendados para você",
        description:   "Profissionais selecionados com base no seu histórico e preferências.",
        professionals: forYou,
      },
      {
        id:            "top_rated",
        title:         "Bem avaliados",
        description:   "Os melhores avaliados pelos tutores do Peteen.",
        professionals: topRated,
      },
      {
        id:            "recurring",
        title:         "Tutores que voltaram",
        description:   "Profissionais com clientes recorrentes — sinal de confiança real.",
        professionals: recurringBlock,
      },
      {
        id:            "verified",
        title:         "Verificados pelo Peteen",
        description:   "Perfis revisados e aprovados pela nossa equipe.",
        professionals: verifiedBlock,
      },
      {
        id:            "partner_endorsed",
        title:         "Recomendados por Parceiros",
        description:   "Indicados por clínicas, pet shops e ONGs parceiras da rede Peteen.",
        professionals: partnerEndorsedBlock,
      },
    ]

    return allBlocks.filter((b) => b.professionals.length > 0)
  } catch {
    return []
  }
}

// ── API pública — Backoffice ──────────────────────────────────────────────────

/**
 * getAdminRecommendationScores — retorna todos os profissionais com score
 * calculado sem contexto de tutor (métricas internas puras).
 *
 * Usado em /admin/recommendations para monitorar a qualidade das recomendações.
 */
export async function getAdminRecommendationScores(): Promise<RecommendedProfessional[]> {
  const emptyCtx: RecommendationContext = {
    tutorCity:            null,
    tutorNeighborhood:    null,
    tutorRegionId:        null,
    tutorNeighborhoodId:  null,
    requestedServiceType: null,
    myRelMap:             new Map(),
  }

  try {
    const { scored } = await fetchScoredProfessionals(emptyCtx)
    return scored.sort((a, b) => b.score.totalScore - a.score.totalScore)
  } catch {
    return []
  }
}
