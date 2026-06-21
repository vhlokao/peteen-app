/**
 * Módulo: reputation-badges
 * Camada: infrastructure — leituras agregadas (somente leitura)
 */

import { prisma } from "@/lib/prisma/client"
import { getProfessionalVerificationContext } from "@/modules/professional-crm/application/verification-context"
import { OPERATIONAL_VERIFICATION_LABELS } from "@/modules/professional-crm/domain/verification-messages"
import { getActiveConnectionsBatch } from "@/modules/trust-graph/infrastructure/repository"
import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state"
import { REPUTATION_THRESHOLDS } from "../domain/constants"
import { resolveReputationBadges } from "../domain/resolver"
import type {
  ReputationSnapshot,
  ReputationTrustSummary,
} from "../domain/types"

type ProfileRow = {
  id: string
  trustScore: number
  isVerified: boolean
  verifiedIdentity: boolean
}

async function fetchReviewStatsByProfessional(
  professionalIds: string[]
): Promise<Map<string, { count: number; avg: number | null }>> {
  const map = new Map<string, { count: number; avg: number | null }>()
  if (professionalIds.length === 0) return map

  const stats = await prisma.$queryRaw<
    Array<{ professionalId: string; count: bigint; avg: number | null }>
  >`
    SELECT sr."professionalId",
           COUNT(r.id)::bigint AS count,
           AVG(r.rating) AS avg
    FROM reviews r
    JOIN service_requests sr ON sr.id = r."requestId"
    WHERE sr."professionalId" = ANY(${professionalIds})
      AND r."isVisible" = TRUE
      AND r."hiddenByAdmin" = FALSE
    GROUP BY sr."professionalId"
  `

  for (const row of stats) {
    map.set(row.professionalId, {
      count: Number(row.count),
      avg: row.avg,
    })
  }

  return map
}

async function fetchCompletedServicesMap(
  professionalIds: string[]
): Promise<Map<string, number>> {
  if (professionalIds.length === 0) return new Map()

  const rows = await prisma.serviceRequest.groupBy({
    by: ["professionalId"],
    where: {
      professionalId: { in: professionalIds },
      status: "COMPLETED",
    },
    _count: { id: true },
  })

  return new Map(rows.map((r) => [r.professionalId, r._count.id]))
}

async function fetchRecurringClientsMap(
  professionalIds: string[]
): Promise<Map<string, number>> {
  if (professionalIds.length === 0) return new Map()

  const rows = await prisma.tutorProfessionalRelationship.groupBy({
    by: ["professionalId"],
    where: {
      professionalId: { in: professionalIds },
      completedServices: { gte: REPUTATION_THRESHOLDS.RECURRING_RELATIONSHIP },
    },
    _count: { id: true },
  })

  return new Map(rows.map((r) => [r.professionalId, r._count.id]))
}

async function fetchProfiles(
  professionalIds: string[]
): Promise<Map<string, ProfileRow>> {
  if (professionalIds.length === 0) return new Map()

  const rows = await prisma.professionalProfile.findMany({
    where: { id: { in: professionalIds }, deletedAt: null },
    select: {
      id: true,
      trustScore: true,
      isVerified: true,
      verifiedIdentity: true,
    },
  })

  return new Map(rows.map((r) => [r.id, r]))
}

function buildSnapshot(
  profile: ProfileRow,
  completedServices: number,
  reviewStats: { count: number; avg: number | null },
  recurringClientsCount: number,
  activeRecommendationsCount: number,
  viewerRelationshipCompletedServices?: number
): ReputationSnapshot {
  return {
    professionalId: profile.id,
    trustScore: profile.trustScore,
    verificationActive: isProfessionalVerificationActive(profile),
    completedServices,
    reviewCount: reviewStats.count,
    averageRating: reviewStats.avg,
    recurringClientsCount,
    activeRecommendationsCount,
    viewerRelationshipCompletedServices,
  }
}

export async function getReputationSnapshot(
  professionalId: string,
  options?: { viewerRelationshipCompletedServices?: number }
): Promise<ReputationSnapshot | null> {
  const profiles = await fetchProfiles([professionalId])
  const profile = profiles.get(professionalId)
  if (!profile) return null

  const [completedMap, reviewMap, recurringMap, connectionsMap] =
    await Promise.all([
      fetchCompletedServicesMap([professionalId]),
      fetchReviewStatsByProfessional([professionalId]),
      fetchRecurringClientsMap([professionalId]),
      getActiveConnectionsBatch([professionalId]),
    ])

  return buildSnapshot(
    profile,
    completedMap.get(professionalId) ?? 0,
    reviewMap.get(professionalId) ?? { count: 0, avg: null },
    recurringMap.get(professionalId) ?? 0,
    connectionsMap.get(professionalId)?.length ?? 0,
    options?.viewerRelationshipCompletedServices
  )
}

export async function getReputationSnapshotsBatch(
  professionalIds: string[],
  viewerRelationships?: Map<string, number>
): Promise<Map<string, ReputationSnapshot>> {
  const result = new Map<string, ReputationSnapshot>()
  if (professionalIds.length === 0) return result

  const [profiles, completedMap, reviewMap, recurringMap, connectionsMap] =
    await Promise.all([
      fetchProfiles(professionalIds),
      fetchCompletedServicesMap(professionalIds),
      fetchReviewStatsByProfessional(professionalIds),
      fetchRecurringClientsMap(professionalIds),
      getActiveConnectionsBatch(professionalIds),
    ])

  for (const id of professionalIds) {
    const profile = profiles.get(id)
    if (!profile) continue

    result.set(
      id,
      buildSnapshot(
        profile,
        completedMap.get(id) ?? 0,
        reviewMap.get(id) ?? { count: 0, avg: null },
        recurringMap.get(id) ?? 0,
        connectionsMap.get(id)?.length ?? 0,
        viewerRelationships?.get(id)
      )
    )
  }

  return result
}

export async function getReputationTrustSummary(
  professionalId: string,
  options?: { viewerRelationshipCompletedServices?: number }
): Promise<ReputationTrustSummary | null> {
  const snapshot = await getReputationSnapshot(professionalId, options)
  if (!snapshot) return null

  const profile = await prisma.professionalProfile.findUnique({
    where: { id: professionalId },
    select: { isVerified: true, verifiedIdentity: true },
  })
  if (!profile) return null

  const verification = await getProfessionalVerificationContext(
    professionalId,
    profile
  )

  const badges = resolveReputationBadges(snapshot)

  return {
    trustScore: snapshot.trustScore,
    totalReviews: snapshot.reviewCount,
    averageRating: snapshot.averageRating,
    recurringClientsCount: snapshot.recurringClientsCount,
    completedServices: snapshot.completedServices,
    recommendationsCount: snapshot.activeRecommendationsCount,
    verificationStatus: verification.operationalStatus,
    verificationLabel:
      OPERATIONAL_VERIFICATION_LABELS[verification.operationalStatus],
    badges,
  }
}
