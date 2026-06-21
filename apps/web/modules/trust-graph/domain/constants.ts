/**
 * módulo: trust-graph
 * camada: domain — constantes
 *
 * Pesos e limites centralizados do Trust Graph.
 * Puro — sem IO, sem dependências externas.
 */

import type { TrustConnectionType } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// PESOS POR TIPO DE CONEXÃO
// ─────────────────────────────────────────────────────────────────────────────

export const TRUST_CONNECTION_WEIGHTS: Record<TrustConnectionType, number> = {
  PARTNER_RECOMMENDS_PROFESSIONAL:        5,
  PROFESSIONAL_RECOMMENDS_PROFESSIONAL:   3,
  TUTOR_RECOMMENDS_PROFESSIONAL:          2,
}

// ─────────────────────────────────────────────────────────────────────────────
// LIMITES
// ─────────────────────────────────────────────────────────────────────────────

/** Bônus máximo que o Trust Graph pode adicionar ao Trust Score */
export const MAX_TRUST_GRAPH_BONUS = 20

/** Bônus máximo que o Trust Graph pode adicionar ao Recommendation Score */
export const MAX_TRUST_GRAPH_REC_BONUS = 10

// ─────────────────────────────────────────────────────────────────────────────
// LABELS DE EXIBIÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export const CONNECTION_TYPE_LABELS: Record<TrustConnectionType, string> = {
  PARTNER_RECOMMENDS_PROFESSIONAL:        "Parceiro recomenda Profissional",
  TUTOR_RECOMMENDS_PROFESSIONAL:          "Tutor recomenda Profissional",
  PROFESSIONAL_RECOMMENDS_PROFESSIONAL:   "Profissional recomenda Profissional",
}

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  PARTNER:      "Parceiro",
  TUTOR:        "Tutor",
  PROFESSIONAL: "Profissional",
}

/** Tipos de conexão compatíveis por tipo de origem */
export const CONNECTION_TYPES_BY_SOURCE: Record<string, TrustConnectionType[]> = {
  PARTNER:      ["PARTNER_RECOMMENDS_PROFESSIONAL"],
  TUTOR:        ["TUTOR_RECOMMENDS_PROFESSIONAL"],
  PROFESSIONAL: ["PROFESSIONAL_RECOMMENDS_PROFESSIONAL"],
}
