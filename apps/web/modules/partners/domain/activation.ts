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

/**
 * Rótulo QUALITATIVO do score — nunca a porcentagem de novo.
 *
 * Os três consumidores (wizard, admin, perfil público) renderizam
 * `{score}% ({label})`, então devolver porcentagem aqui produzia "80% (80%)".
 * Pior: os limiares eram 30/50/80 enquanto `computeActivationScore` só produz
 * múltiplos de 20 — um score de 40 caía no bucket ">= 30" e a tela dizia
 * "40% (30%)", divergindo do número ao lado dela.
 *
 * Os cortes agora coincidem com os degraus que o cálculo realmente atinge
 * (0, 20, 40, 60, 80, 100). A REGRA não mudou: computeActivationScore está
 * intocado — o que mudou é como o mesmo número é lido em voz alta.
 */
export function activationScoreLabel(score: number): string {
  if (score >= 100) return "Perfil completo"
  if (score >= 80) return "Quase completo"
  if (score >= 60) return "Bom começo"
  if (score >= 40) return "Em construção"
  return "Iniciando"
}
