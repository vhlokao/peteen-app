/**
 * módulo: recommendation
 * camada: domain
 *
 * computeRecommendationScore — função pura, sem IO, sem efeitos colaterais.
 *
 * Fórmula de scoring (max 100 pts):
 *
 *   1. Mesma cidade              20 pts
 *   2. Serviço compatível        15 pts (filtro ativo) | 5 pts (sem filtro)
 *   3. Trust Score normalizado   25 pts  (trustScore / 100 × 25)
 *   4. Badges ativos             10 pts  (2 pts/badge, máx 5 badges)
 *   5. Recorrência pessoal       15 pts  (≥3 sessões → 15 | ≥1 → 7)
 *   6. Qualidade das avaliações  10 pts
 *   7. Verificado pelo Peteen     5 pts
 *   8. Trust Graph               10 pts  (parceiros ×4 + profissionais ×2 + tutores ×1, cap 10)
 *   9. Proximidade local (6.0)  10 pts  (mesmo bairro +10 | mesma região +5, cap 10)
 *
 *   Preço NÃO é fator — alinhado com o princípio Peteen de confiança > custo.
 */

import type { RecommendationInput, RecommendationScore, RecommendationFactor } from "./types"
import { computeLocalRecommendationBonus } from "@/modules/growth-engine/domain/scoring"

export const MAX_RECOMMENDATION_SCORE = 100

export function computeRecommendationScore(input: RecommendationInput): RecommendationScore {
  const factors: RecommendationFactor[] = []

  // ── 1. Mesma cidade (20 pts) ─────────────────────────────────────────────────
  if (
    input.tutorCity &&
    input.professionalCity.toLowerCase().trim() === input.tutorCity.toLowerCase().trim()
  ) {
    factors.push({ key: "city", label: "Mesma cidade", points: 20 })
  }

  // ── 2. Serviço compatível (15 ou 5 pts) ─────────────────────────────────────
  const hasService = input.requestedServiceType
    ? input.professionalServiceTypes.includes(input.requestedServiceType)
    : input.professionalServiceTypes.length > 0
  if (hasService) {
    const pts = input.requestedServiceType ? 15 : 5
    factors.push({ key: "service", label: "Serviço compatível", points: pts })
  }

  // ── 3. Trust Score normalizado (0–25 pts) ────────────────────────────────────
  const trustPts = Math.round((Math.min(input.trustScore, 100) / 100) * 25)
  if (trustPts > 0) {
    factors.push({
      key:    "trust",
      label:  `Índice de Confiança ${input.trustScore.toFixed(0)}`,
      points: trustPts,
    })
  }

  // ── 4. Badges ativos (2 pts/badge, máx 10 pts) ───────────────────────────────
  const badgePts = Math.min(10, input.activeBadgeCount * 2)
  if (badgePts > 0) {
    factors.push({
      key:    "badges",
      label:  `${input.activeBadgeCount} badge${input.activeBadgeCount !== 1 ? "s" : ""}`,
      points: badgePts,
    })
  }

  // ── 5. Recorrência pessoal do tutor (0–15 pts) ──────────────────────────────
  const recPts =
    input.tutorCompletedServices >= 3 ? 15 :
    input.tutorCompletedServices >= 1 ? 7  : 0
  if (recPts > 0) {
    factors.push({
      key:    "personal_recurrence",
      label:  `${input.tutorCompletedServices} atend. anterior${input.tutorCompletedServices !== 1 ? "es" : ""}`,
      points: recPts,
    })
  }

  // ── 6. Qualidade das avaliações (0–10 pts) ──────────────────────────────────
  const revPts =
    (input.reviewCount >= 5 && input.averageRating !== null && input.averageRating >= 4.5) ? 10 :
    (input.reviewCount >= 3 && input.averageRating !== null && input.averageRating >= 4.0) ? 6  :
    input.reviewCount >= 1                                                                  ? 2  : 0
  if (revPts > 0) {
    factors.push({
      key:    "reviews",
      label:  `${input.reviewCount} aval. · ${input.averageRating?.toFixed(1) ?? "–"}★`,
      points: revPts,
    })
  }

  // ── 7. Verificado pelo Peteen (5 pts) ────────────────────────────────────────
  if (input.isVerified) {
    factors.push({ key: "verified", label: "Perfil verificado", points: 5 })
  }

  // ── 8. Trust Graph — Etapa 5.8 (0–10 pts) ────────────────────────────────────
  const tgRaw =
    (input.partnerEndorsements      ?? 0) * 4 +
    (input.professionalEndorsements ?? 0) * 2 +
    (input.tutorEndorsements        ?? 0) * 1
  const tgPts = Math.min(10, tgRaw)
  if (tgPts > 0) {
    const totalEndorsements =
      (input.partnerEndorsements ?? 0) +
      (input.professionalEndorsements ?? 0) +
      (input.tutorEndorsements ?? 0)
    factors.push({
      key:    "trust_graph",
      label:  `Recomendado por ${totalEndorsements} conex${totalEndorsements !== 1 ? "ões" : "ão"}`,
      points: tgPts,
    })
  }

  // ── 9. Bônus local — Etapa 6.0 (0–10 pts) ───────────────────────────────────
  const localBonus = computeLocalRecommendationBonus({
    tutorNeighborhood:          input.tutorNeighborhood,
    tutorRegionId:              input.tutorRegionId,
    professionalNeighborhood:   input.professionalNeighborhood,
    professionalRegionId:       input.professionalRegionId,
    tutorNeighborhoodId:        input.tutorNeighborhoodId,
    professionalNeighborhoodId: input.professionalNeighborhoodId,
  })
  if (localBonus.points > 0 && localBonus.label) {
    factors.push({
      key:    "local_proximity",
      label:  localBonus.label,
      points: localBonus.points,
    })
  }

  // ── Totais ───────────────────────────────────────────────────────────────────
  const totalScore = Math.min(
    MAX_RECOMMENDATION_SCORE,
    factors.reduce((sum, f) => sum + f.points, 0)
  )

  const sortedFactors = [...factors].sort((a, b) => b.points - a.points)
  const mainReason    = sortedFactors[0]?.label ?? "Profissional disponível"

  return {
    professionalId: input.professionalId,
    totalScore,
    factors:        sortedFactors,
    mainReason,
  }
}
