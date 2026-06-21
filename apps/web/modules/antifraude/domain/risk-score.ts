/**
 * módulo: antifraude
 * camada: domain
 *
 * Cálculo de Risk Score para profissionais.
 *
 * Risk Score: 0–100 (maior = mais risco).
 * Não bloqueia usuários — apenas monitora e sinaliza para revisão manual.
 *
 * Faixas:
 *   0–20   → Baixo risco
 *   21–50  → Médio risco
 *   51–80  → Alto risco
 *   81–100 → Crítico
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW:      "Baixo risco",
  MEDIUM:   "Médio risco",
  HIGH:     "Alto risco",
  CRITICAL: "Crítico",
}

export type RiskFactors = {
  openFlags:          number   // flags OPEN relacionadas ao profissional
  totalDisputes:      number   // disputas (qualquer status)
  hiddenReviews:      number   // reviews ocultadas por admin
  cancelledByPro:     number   // cancelamentos pelo profissional
  totalRequests:      number   // total de solicitações (para taxa)
}

export type RiskScoreResult = {
  score:     number
  level:     RiskLevel
  breakdown: {
    flagPenalty:        number
    disputePenalty:     number
    hiddenReviewPenalty: number
    cancellationPenalty: number
  }
}

export function computeRiskScore(factors: RiskFactors): RiskScoreResult {
  // Cada flag aberta: +10 pts (máx 30)
  const flagPenalty = Math.min(factors.openFlags * 10, 30)

  // Cada disputa: +15 pts (máx 30)
  const disputePenalty = Math.min(factors.totalDisputes * 15, 30)

  // Cada review ocultada: +8 pts (máx 20)
  const hiddenReviewPenalty = Math.min(factors.hiddenReviews * 8, 20)

  // Taxa de cancelamento pelo profissional: se > 30% → até 20 pts
  let cancellationPenalty = 0
  if (factors.totalRequests > 0) {
    const rate = factors.cancelledByPro / factors.totalRequests
    cancellationPenalty = Math.min(Math.round(rate * 60), 20)
  }

  const raw = flagPenalty + disputePenalty + hiddenReviewPenalty + cancellationPenalty
  const score = Math.min(100, Math.max(0, raw))

  return {
    score,
    level: resolveRiskLevel(score),
    breakdown: {
      flagPenalty,
      disputePenalty,
      hiddenReviewPenalty,
      cancellationPenalty,
    },
  }
}

export function resolveRiskLevel(score: number): RiskLevel {
  if (score <= 20) return "LOW"
  if (score <= 50) return "MEDIUM"
  if (score <= 80) return "HIGH"
  return "CRITICAL"
}
