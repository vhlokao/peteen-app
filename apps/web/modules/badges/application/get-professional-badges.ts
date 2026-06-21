/**
 * módulo: badges
 * camada: application
 *
 * Funções para buscar dados necessários ao cálculo de badges de um profissional.
 * Não são Server Actions — são helpers chamados por Server Components ou Actions.
 */

import { prisma } from "@/lib/prisma/client"
import { resolveBadges, getBadgesForCard } from "../domain/resolver"
import type { BadgeInput, BadgeResolverResult, BadgeData } from "../domain/types"
import { getActiveConnectionsBatch } from "@/modules/trust-graph/infrastructure/repository"
import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state"

// ── Single professional ────────────────────────────────────────────────────────

/**
 * getProfessionalBadges — busca todos os dados e resolve badges para um profissional.
 *
 * Usado na página de perfil público e no admin.
 */
export async function getProfessionalBadges(
  professionalId: string
): Promise<BadgeResolverResult> {
  const [profile, stats] = await Promise.all([
    prisma.professionalProfile.findUnique({
      where:  { id: professionalId },
      select: {
        trustScore:       true,
        isVerified:       true,
        verifiedIdentity: true,
        verifiedPhone:    true,
        verifiedPartner:  true,
      },
    }),
    prisma.serviceRequest.aggregate({
      where:  { professionalId, status: "COMPLETED" },
      _count: { id: true },
    }),
  ])

  if (!profile) {
    return { badges: [], verifications: [] }
  }

  const [reviewAgg, connectionsMap] = await Promise.all([
    prisma.review.aggregate({
      where: {
        request: { professionalId },
        isVisible:     true,
        hiddenByAdmin: false,
      },
      _count: { id: true },
      _avg:   { rating: true },
    }),
    getActiveConnectionsBatch([professionalId]),
  ])

  const connections = connectionsMap.get(professionalId) ?? []
  const partnerEndorsements = connections.filter(
    (c) => c.connectionType === "PARTNER_RECOMMENDS_PROFESSIONAL"
  ).length

  const verificationActive = isProfessionalVerificationActive(profile)

  const input: BadgeInput = {
    completedServices:   stats._count.id,
    trustScore:          profile.trustScore,
    reviewCount:         reviewAgg._count.id,
    averageRating:       reviewAgg._avg.rating,
    verifiedProfile:     verificationActive,
    verifiedIdentity:    profile.verifiedIdentity,
    verifiedPhone:       profile.verifiedPhone,
    verifiedPartner:     profile.verifiedPartner,
    partnerEndorsements,
  }

  return resolveBadges(input)
}

// ── Batch para o Discovery ────────────────────────────────────────────────────

/**
 * getCompletedServicesMap — retorna um Map de professionalId → completedServices.
 * Uma única query para todos os profissionais da tela de Discovery.
 *
 * Evita N+1 — chamada uma vez por página com todos os IDs.
 */
export async function getCompletedServicesMap(
  professionalIds: string[]
): Promise<Map<string, number>> {
  if (professionalIds.length === 0) return new Map()

  try {
    const results = await prisma.serviceRequest.groupBy({
      by:    ["professionalId"],
      where: {
        professionalId: { in: professionalIds },
        status:         "COMPLETED",
      },
      _count: { id: true },
    })

    return new Map(results.map((r) => [r.professionalId, r._count.id]))
  } catch {
    return new Map()
  }
}

/**
 * computeBadgesFromDiscoveryData — calcula badges a partir dos dados já disponíveis
 * no RankedProfile, mais o completedServices do Map de batch.
 *
 * Sem queries adicionais — usa dados já carregados no Discovery.
 */
export function computeBadgesFromDiscoveryData(params: {
  trustScore:          number
  reviewCount:         number
  averageRating:       number | null
  isVerified:          boolean
  verifiedIdentity:    boolean
  completedServices:   number
  partnerEndorsements?: number
}): BadgeData[] {
  const verificationActive = isProfessionalVerificationActive({
    isVerified: params.isVerified,
    verifiedIdentity: params.verifiedIdentity,
  })

  const input: BadgeInput = {
    completedServices:   params.completedServices,
    trustScore:          params.trustScore,
    reviewCount:         params.reviewCount,
    averageRating:       params.averageRating,
    verifiedProfile:     verificationActive,
    verifiedIdentity:    params.verifiedIdentity,
    verifiedPhone:       false,
    verifiedPartner:     false,
    partnerEndorsements: params.partnerEndorsements ?? 0,
  }

  const { badges } = resolveBadges(input)
  return getBadgesForCard(badges, 2)
}

// ── Batch para o Backoffice ───────────────────────────────────────────────────

export type ProfessionalBadgeSummary = {
  professionalId: string
  displayName:    string
  city:           string
  trustScore:     number
  isVerified:     boolean
  isVerificationActive: boolean
  badges:         BadgeData[]
  reviewCount:    number
  completedServices: number
}

export async function getAllProfessionalBadgeSummaries(): Promise<ProfessionalBadgeSummary[]> {
  const professionals = await prisma.professionalProfile.findMany({
    where:  { deletedAt: null },
    select: {
      id:               true,
      displayName:      true,
      city:             true,
      trustScore:       true,
      isVerified:       true,
      verifiedIdentity: true,
      verifiedPhone:    true,
      verifiedPartner:  true,
    },
    orderBy: { displayName: "asc" },
  })

  if (professionals.length === 0) return []

  const ids = professionals.map((p) => p.id)

  const [completedMap, reviewStats, endorsementsMap] = await Promise.all([
    getCompletedServicesMap(ids),
    prisma.review.groupBy({
      by:    ["requestId"],
      where: { request: { professionalId: { in: ids } }, isVisible: true, hiddenByAdmin: false },
      _count: { id: true },
      _avg:   { rating: true },
    }    ).then(async () => {
      // groupBy por professionalId via SQL raw para eficiência
      const rows = await prisma.$queryRaw<
        Array<{ professionalId: string; count: bigint; avg: number | null }>
      >`
        SELECT sr."professionalId", COUNT(r.id) as count, AVG(r.rating) as avg
        FROM reviews r
        JOIN service_requests sr ON sr.id = r."requestId"
        WHERE sr."professionalId" = ANY(${ids})
          AND r."isVisible" = TRUE
          AND r."hiddenByAdmin" = FALSE
        GROUP BY sr."professionalId"
      `
      return new Map(rows.map((row) => [
        row.professionalId,
        { count: Number(row.count), avg: row.avg ?? null },
      ]))
    }),
    getActiveConnectionsBatch(ids),
  ])

  return professionals.map((pro) => {
    const completed    = completedMap.get(pro.id) ?? 0
    const revStat      = reviewStats.get(pro.id) ?? { count: 0, avg: null }
    const endorsements = endorsementsMap.get(pro.id) ?? []
    const partnerEndorsements = endorsements.filter(
      (c) => c.connectionType === "PARTNER_RECOMMENDS_PROFESSIONAL"
    ).length
    const verificationActive = isProfessionalVerificationActive(pro)
    const input: BadgeInput = {
      completedServices:   completed,
      trustScore:          pro.trustScore,
      reviewCount:         revStat.count,
      averageRating:       revStat.avg,
      verifiedProfile:     verificationActive,
      verifiedIdentity:    pro.verifiedIdentity,
      verifiedPhone:       pro.verifiedPhone,
      verifiedPartner:     pro.verifiedPartner,
      partnerEndorsements,
    }
    const { badges } = resolveBadges(input)

    return {
      professionalId:    pro.id,
      displayName:       pro.displayName,
      city:              pro.city,
      trustScore:        pro.trustScore,
      isVerified:        pro.isVerified,
      isVerificationActive: verificationActive,
      badges,
      reviewCount:       revStat.count,
      completedServices: completed,
    }
  })
}
