/**
 * módulo: trust-engine
 * camada: domain — tipos
 */

import type { TrustLevel } from "@/modules/professional/domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN — decomposição auditável do score
//
// Cada campo representa uma fonte de contribuição independente.
// O breakdown é retornado junto com o score para auditoria e exibição na UI.
// ─────────────────────────────────────────────────────────────────────────────

export type TrustBreakdown = {
  /** Soma dos pesos de events REVIEW_POSITIVE / REVIEW_NEUTRAL / REVIEW_NEGATIVE */
  reviews: number
  /** Soma dos pesos de events RECURRENCE_COMPLETED */
  completions: number
  /** Bônus progressivo de recorrência calculado do histórico de ServiceRequests */
  recurrence: number
  /** Bônus de verificação e eventos manuais (exceto identidade verificada) */
  bonuses: number
  /** Bônus IDENTITY_VERIFIED (+3) quando verifiedIdentity=true */
  identityVerified: number
  /** Penalidades acumuladas (cancelamentos, fraude) */
  penalties: number
  /** Etapa 5.8 — bônus do Trust Graph (parceiros + profissionais + tutores que recomendam) */
  trustGraphBonus: number
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST SCORE RESULT
// ─────────────────────────────────────────────────────────────────────────────

export type TrustScoreResult = {
  /** Score consolidado, clamped entre 0 e 100 */
  score: number
  /** Nível derivado do score — persiste em ProfessionalProfile.trustLevel */
  level: TrustLevel
  /** Decomposição auditável das fontes de score */
  breakdown: TrustBreakdown
  /** Contadores auxiliares para o painel de debug */
  meta: {
    totalEvents: number
    totalCompletedRequests: number
    uniqueRecurringTutors: number
    /** Etapa 6.0 — contexto territorial (metadata, não altera score) */
    territorial?: {
      neighborhood:       string | null
      region:             string | null
      city:               string
      state:              string
      rankInNeighborhood: number | null
      rankInCity:         number | null
      totalInNeighborhood: number
      totalInCity:        number
    }
  }
}
