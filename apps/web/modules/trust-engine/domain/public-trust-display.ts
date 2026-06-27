/**
 * módulo: trust-engine
 * camada: domain — helpers de exibição pública
 *
 * Traduz o Trust Score para três estados visíveis ao tutor no Discovery:
 *
 *   "building"  → sem evidência real de confiança
 *                 exibe "Confiança em construção"
 *
 *   "initial"   → há evidência (recomendação, avaliação, verificação…),
 *                 mas score ainda dentro do nível INITIAL (0–20 pts)
 *                 exibe "Confiança inicial"
 *
 *   "score"     → nível acima de INITIAL — exibir score numérico + nível
 *
 * NÃO altera cálculo, pesos, thresholds ou Trust Engine.
 */

import type { TrustLevel } from "@/modules/professional/domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// TIPO — evidências disponíveis no contexto público
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Campos de evidência disponíveis nos componentes de Discovery.
 * Todos opcionais — use apenas os que existem no payload do componente.
 */
export type PublicTrustEvidence = {
  /** Score persistido ou ao vivo — > 0 indica eventos de confiança reais */
  trustScore?: number
  /** Quantidade de avaliações públicas */
  reviewCount?: number
  /** Perfil verificado pela equipe Peteen */
  isVerified?: boolean
  /** Recomendado por ao menos um parceiro */
  hasPartnerEndorsement?: boolean
  /** Possui badge reputacional */
  hasReputationBadge?: boolean
  /** Tutores recorrentes (3+ sessões) */
  recurringClientsCount?: number
  /** Atendimentos concluídos */
  completedCount?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO PÚBLICO
// ─────────────────────────────────────────────────────────────────────────────

export type PublicTrustState = "building" | "initial" | "score"

/**
 * Retorna true se o profissional possui ao menos um sinal real de confiança.
 */
export function hasPublicTrustEvidence(evidence: PublicTrustEvidence): boolean {
  return (
    (evidence.trustScore !== undefined && evidence.trustScore > 0) ||
    (evidence.reviewCount !== undefined && evidence.reviewCount > 0) ||
    evidence.isVerified === true ||
    evidence.hasPartnerEndorsement === true ||
    evidence.hasReputationBadge === true ||
    (evidence.recurringClientsCount !== undefined && evidence.recurringClientsCount > 0) ||
    (evidence.completedCount !== undefined && evidence.completedCount > 0)
  )
}

/**
 * Determina o estado de exibição pública do Índice de Confiança.
 *
 * - Nível acima de INITIAL → "score" (exibir numericamente)
 * - INITIAL com evidência   → "initial" ("Confiança inicial")
 * - INITIAL sem evidência   → "building" ("Confiança em construção")
 *
 * trustScore é incluído automaticamente na verificação de evidência.
 */
export function getPublicTrustState(
  trustScore: number,
  trustLevel: TrustLevel,
  evidence: PublicTrustEvidence,
): PublicTrustState {
  if (trustLevel !== "INITIAL") return "score"
  return hasPublicTrustEvidence({ ...evidence, trustScore }) ? "initial" : "building"
}

// ─────────────────────────────────────────────────────────────────────────────
// LABELS E MENSAGENS
// ─────────────────────────────────────────────────────────────────────────────

/** Estado "building" — sem evidência real */
export const PUBLIC_TRUST_BUILDING_LABEL = "Confiança em construção" as const
export const PUBLIC_TRUST_BUILDING_MESSAGE =
  "Este profissional está começando no Peteen. A confiança será construída com atendimentos concluídos, avaliações reais e recorrência." as const

/** Estado "initial" — evidência presente, nível ainda INITIAL */
export const PUBLIC_TRUST_INITIAL_LABEL = "Confiança inicial" as const
export const PUBLIC_TRUST_INITIAL_MESSAGE =
  "Este profissional já possui primeiros sinais de confiança, como recomendações, avaliações ou histórico inicial na plataforma." as const
