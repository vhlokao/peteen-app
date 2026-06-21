/**
 * Módulo: reputation-badges
 * Camada: domain — resolver puro (sem IO, sem recálculo de trust)
 */

import {
  REPUTATION_BADGE_META,
  REPUTATION_BADGE_PRIORITY,
  REPUTATION_THRESHOLDS,
} from "./constants"
import type { ReputationBadge, ReputationSnapshot } from "./types"

export function resolveReputationBadges(
  snapshot: ReputationSnapshot
): ReputationBadge[] {
  const badges: ReputationBadge[] = []

  if (snapshot.verificationActive) {
    badges.push({ type: "verified", ...REPUTATION_BADGE_META.verified })
  }

  const hasRecurringClient =
    snapshot.recurringClientsCount > 0 ||
    (snapshot.viewerRelationshipCompletedServices ?? 0) >=
      REPUTATION_THRESHOLDS.RECURRING_RELATIONSHIP

  if (hasRecurringClient) {
    badges.push({ type: "recurring_client", ...REPUTATION_BADGE_META.recurring_client })
  }

  if (
    snapshot.reviewCount >= REPUTATION_THRESHOLDS.HIGHLY_RATED_MIN_REVIEWS &&
    snapshot.averageRating !== null &&
    snapshot.averageRating >= REPUTATION_THRESHOLDS.HIGHLY_RATED_MIN_AVERAGE
  ) {
    badges.push({ type: "highly_rated", ...REPUTATION_BADGE_META.highly_rated })
  }

  if (
    snapshot.completedServices >= REPUTATION_THRESHOLDS.EXPERIENCED_MIN_SERVICES
  ) {
    badges.push({ type: "experienced", ...REPUTATION_BADGE_META.experienced })
  }

  if (snapshot.activeRecommendationsCount > 0) {
    badges.push({ type: "recommended", ...REPUTATION_BADGE_META.recommended })
  }

  badges.sort(
    (a, b) =>
      REPUTATION_BADGE_PRIORITY.indexOf(a.type) -
      REPUTATION_BADGE_PRIORITY.indexOf(b.type)
  )

  return badges
}

export function getReputationBadgesForCard(
  badges: ReputationBadge[],
  max = 4
): ReputationBadge[] {
  return badges.slice(0, max)
}
