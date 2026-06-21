/**
 * módulo: partners
 * camada: domain — activation score (Etapa 6.1)
 *
 * Cada critério vale 20 pts → total 0–100.
 */

export type ActivationInput = {
  businessName:          string
  city:                  string
  state:                 string
  phone:                 string | null
  logoUrl:               string | null
  description:           string | null
  recommendationCount:   number
  verificationRequested: boolean
}

const CRITERION_POINTS = 20

export function computeActivationScore(input: ActivationInput): number {
  let score = 0

  if (
    input.businessName.trim() &&
    input.city.trim() &&
    input.state.trim() &&
    input.phone?.trim()
  ) {
    score += CRITERION_POINTS
  }

  if (input.logoUrl?.trim()) score += CRITERION_POINTS
  if (input.description?.trim()) score += CRITERION_POINTS
  if (input.recommendationCount > 0) score += CRITERION_POINTS
  if (input.verificationRequested) score += CRITERION_POINTS

  return Math.min(100, score)
}

export function activationScoreLabel(score: number): string {
  if (score >= 100) return "100%"
  if (score >= 80) return "80%"
  if (score >= 50) return "50%"
  if (score >= 30) return "30%"
  return "Iniciando"
}
