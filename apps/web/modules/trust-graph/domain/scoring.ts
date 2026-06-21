/**
 * módulo: trust-graph
 * camada: domain — scoring
 *
 * Funções puras para cálculo de bônus de Trust Graph.
 * Sem IO, sem Prisma, sem dependências externas.
 */

import type { ActiveConnection, TrustEndorsementSummary } from "./types"
import { TRUST_CONNECTION_WEIGHTS, MAX_TRUST_GRAPH_BONUS, MAX_TRUST_GRAPH_REC_BONUS } from "./constants"

// ─────────────────────────────────────────────────────────────────────────────
// BÔNUS NO TRUST ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * computeTrustGraphBonus — calcula o bônus de Trust Graph para o Trust Engine.
 *
 * Regras:
 *   - Partner → +5 por conexão ativa
 *   - Professional → +3 por conexão ativa
 *   - Tutor → +2 por conexão ativa
 *   - Limite: MAX_TRUST_GRAPH_BONUS (20 pts)
 */
export function computeTrustGraphBonus(connections: ActiveConnection[]): number {
  let bonus = 0
  for (const conn of connections) {
    bonus += TRUST_CONNECTION_WEIGHTS[conn.connectionType] ?? 0
  }
  return Math.min(bonus, MAX_TRUST_GRAPH_BONUS)
}

// ─────────────────────────────────────────────────────────────────────────────
// BÔNUS NO RECOMMENDATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * computeTrustGraphRecBonus — calcula o bônus de Trust Graph para o Recommendation Engine.
 *
 * Fórmula: min(10, partnerCount * 4 + professionalCount * 2 + tutorCount * 1)
 */
export function computeTrustGraphRecBonus(summary: Pick<TrustEndorsementSummary, "partnerEndorsements" | "professionalEndorsements" | "tutorEndorsements">): number {
  const raw =
    summary.partnerEndorsements * 4 +
    summary.professionalEndorsements * 2 +
    summary.tutorEndorsements * 1
  return Math.min(raw, MAX_TRUST_GRAPH_REC_BONUS)
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMO DE ENDOSSOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildEndorsementSummary — consolida conexões ativas em um resumo por tipo.
 */
export function buildEndorsementSummary(connections: ActiveConnection[]): TrustEndorsementSummary {
  let partnerEndorsements = 0
  let professionalEndorsements = 0
  let tutorEndorsements = 0

  for (const conn of connections) {
    if (conn.connectionType === "PARTNER_RECOMMENDS_PROFESSIONAL") partnerEndorsements++
    else if (conn.connectionType === "PROFESSIONAL_RECOMMENDS_PROFESSIONAL") professionalEndorsements++
    else if (conn.connectionType === "TUTOR_RECOMMENDS_PROFESSIONAL") tutorEndorsements++
  }

  return {
    partnerEndorsements,
    professionalEndorsements,
    tutorEndorsements,
    totalBonus: computeTrustGraphBonus(connections),
    connections,
  }
}
