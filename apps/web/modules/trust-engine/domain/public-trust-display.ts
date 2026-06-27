/**
 * módulo: trust-engine
 * camada: domain — helpers de exibição pública
 *
 * Formata a confiança para contexto público (tutor, discovery).
 *
 * Regras:
 *   - Profissional com nível INITIAL não deve ter "0" exibido cruamente.
 *   - No contexto público, mostrar "Confiança em construção" / "Novo na plataforma".
 *   - No portal do profissional, o score numérico real pode continuar visível.
 *
 * NÃO altera cálculo, pesos ou thresholds.
 */

import type { TrustLevel } from "@/modules/professional/domain/types"

/**
 * Retorna true quando o profissional está em fase inicial e o número de score
 * não deve ser exibido cruamente no contexto público.
 *
 * Critério: INITIAL (0–20 pts) OU score ≤ 0 (persisted stale/zero).
 */
export function isPublicTrustBuilding(
  trustScore: number,
  trustLevel: TrustLevel
): boolean {
  return trustLevel === "INITIAL" || trustScore <= 0
}

/**
 * Label de exibição pública quando o profissional está em fase inicial.
 * Transmite construção, não ausência de confiança.
 */
export const PUBLIC_TRUST_BUILDING_LABEL = "Confiança em construção" as const

/**
 * Mensagem educativa para o perfil público de profissional novo.
 * Exibida no lugar do número/barra de progresso vazia.
 */
export const PUBLIC_TRUST_BUILDING_MESSAGE =
  "Este profissional está construindo seu histórico no Peteen. A confiança é formada com atendimentos concluídos, avaliações reais e recorrência — não pode ser comprada." as const
