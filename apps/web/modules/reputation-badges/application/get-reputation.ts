/**
 * Módulo: reputation-badges
 * Camada: application — API de leitura reputacional
 */

import {
  getReputationSnapshot,
  getReputationSnapshotsBatch,
  getReputationTrustSummary,
} from "../infrastructure/queries"
import { getReputationBadgesForCard, resolveReputationBadges } from "../domain/resolver"
import type { ReputationBadge, ReputationTrustSummary } from "../domain/types"

export async function getProfessionalReputationBadges(
  professionalId: string,
  options?: {
    max?: number
    viewerRelationshipCompletedServices?: number
  }
): Promise<ReputationBadge[]> {
  const snapshot = await getReputationSnapshot(professionalId, {
    viewerRelationshipCompletedServices:
      options?.viewerRelationshipCompletedServices,
  })
  if (!snapshot) return []

  const badges = resolveReputationBadges(snapshot)
  return getReputationBadgesForCard(badges, options?.max ?? 4)
}

export async function getProfessionalReputationBadgesBatch(
  professionalIds: string[],
  viewerRelationships?: Map<string, number>,
  max = 4
): Promise<Map<string, ReputationBadge[]>> {
  const snapshots = await getReputationSnapshotsBatch(
    professionalIds,
    viewerRelationships
  )
  const result = new Map<string, ReputationBadge[]>()

  for (const [id, snapshot] of snapshots) {
    result.set(id, getReputationBadgesForCard(resolveReputationBadges(snapshot), max))
  }

  return result
}

export async function getProfessionalTrustSummary(
  professionalId: string,
  options?: { viewerRelationshipCompletedServices?: number }
): Promise<ReputationTrustSummary | null> {
  return getReputationTrustSummary(professionalId, options)
}
