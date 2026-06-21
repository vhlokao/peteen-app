/**
 * módulo: badges
 * camada: domain
 *
 * resolveBadges — função pura que determina badges ativos dado um conjunto de inputs.
 *
 * Sem efeitos colaterais. Sem IO. Sem dependências externas.
 * Testável de forma isolada com qualquer input.
 *
 * Regras de negócio:
 *   FIRST_CLIENT:  completedServices >= 1
 *   RECURRING:     completedServices >= 3
 *   TRUSTED:       trustScore >= 25
 *   HIGHLY_RATED:  reviewCount >= 5 AND averageRating >= 4.5
 *   EXPERT:        reviewCount >= 10
 */

import type { BadgeInput, BadgeData, VerificationData, BadgeResolverResult } from "./types"
import { BADGE_METADATA, BADGE_DISPLAY_PRIORITY, VERIFICATION_METADATA } from "./constants"

export function resolveBadges(input: BadgeInput): BadgeResolverResult {
  const activeBadges: BadgeData[] = []

  // ── Condições dos badges ──────────────────────────────────────────────────

  if (input.completedServices >= 1) {
    activeBadges.push({ type: "FIRST_CLIENT", ...BADGE_METADATA.FIRST_CLIENT })
  }

  if (input.completedServices >= 3) {
    activeBadges.push({ type: "RECURRING", ...BADGE_METADATA.RECURRING })
  }

  if (input.trustScore >= 25) {
    activeBadges.push({ type: "TRUSTED", ...BADGE_METADATA.TRUSTED })
  }

  if (
    input.reviewCount >= 5 &&
    input.averageRating !== null &&
    input.averageRating >= 4.5
  ) {
    activeBadges.push({ type: "HIGHLY_RATED", ...BADGE_METADATA.HIGHLY_RATED })
  }

  if (input.reviewCount >= 10) {
    activeBadges.push({ type: "EXPERT", ...BADGE_METADATA.EXPERT })
  }

  // Etapa 5.8 — Trust Graph: parceiro ativo recomendando
  if ((input.partnerEndorsements ?? 0) >= 1) {
    activeBadges.push({ type: "PARTNER_ENDORSED", ...BADGE_METADATA.PARTNER_ENDORSED })
  }

  // Ordena por prioridade de exibição
  activeBadges.sort(
    (a, b) =>
      BADGE_DISPLAY_PRIORITY.indexOf(a.type) -
      BADGE_DISPLAY_PRIORITY.indexOf(b.type)
  )

  // ── Selos de verificação ──────────────────────────────────────────────────

  const verifications: VerificationData[] = [
    { type: "VERIFIED_PROFILE",  active: input.verifiedProfile && input.verifiedIdentity, ...VERIFICATION_METADATA.VERIFIED_PROFILE  },
    { type: "VERIFIED_IDENTITY", active: input.verifiedIdentity, ...VERIFICATION_METADATA.VERIFIED_IDENTITY },
    { type: "VERIFIED_PHONE",    active: input.verifiedPhone,    ...VERIFICATION_METADATA.VERIFIED_PHONE    },
    { type: "VERIFIED_PARTNER",  active: input.verifiedPartner,  ...VERIFICATION_METADATA.VERIFIED_PARTNER  },
  ]

  return { badges: activeBadges, verifications }
}

/**
 * getBadgesForCard — retorna no máximo 2 badges, na ordem de prioridade.
 * Usado no card da Discovery para não sobrecarregar o visual.
 */
export function getBadgesForCard(badges: BadgeData[], max = 2): BadgeData[] {
  return badges.slice(0, max)
}
