/**
 * módulo: trust-engine
 * camada: domain — funções puras de scoring
 *
 * Zero dependências externas. Zero acesso ao banco.
 * Testável de forma completamente isolada.
 *
 * Todas as funções recebem dados primitivos e retornam dados primitivos.
 */

import type { TrustLevel } from "@/modules/professional/domain/types"
import {
  TRUST_SCORE_MIN,
  TRUST_SCORE_MAX,
  TRUST_LEVEL_THRESHOLDS,
  RECURRENCE_SESSION_BONUS,
} from "./constants"

// ─────────────────────────────────────────────────────────────────────────────
// resolveTrustLevel
//
// Dado um score numérico, retorna o TrustLevel correspondente.
// Os thresholds são consumidos de constants.ts — nenhum número mágico aqui.
// ─────────────────────────────────────────────────────────────────────────────

export function resolveTrustLevel(score: number): TrustLevel {
  for (const { level, min } of TRUST_LEVEL_THRESHOLDS) {
    if (score >= min) return level as TrustLevel
  }
  return "INITIAL"
}

// ─────────────────────────────────────────────────────────────────────────────
// clampScore
//
// Garante que o score fique dentro do intervalo [0, 100].
// Arredondado para 1 casa decimal para exibição consistente.
// ─────────────────────────────────────────────────────────────────────────────

export function clampScore(raw: number): number {
  const clamped = Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, raw))
  return Math.round(clamped * 10) / 10
}

// ─────────────────────────────────────────────────────────────────────────────
// recurrenceBonusForCount
//
// Calcula o bônus acumulado de recorrência para um único tutor que completou
// `sessionCount` atendimentos com o mesmo profissional.
//
// Lógica progressiva:
//   Sessão 1: +1  (fidelização inicial)
//   Sessão 2: +3  (relação estabelecida)
//   Sessão 3: +5  (confiança confirmada)
//   Sessão 4: +7  (relação duradoura)
//   Sessão 5+: +10 por sessão adicional
//
// O bônus é cumulativo: 3 sessões = 1+3+5 = 9 pontos.
// ─────────────────────────────────────────────────────────────────────────────

export function recurrenceBonusForCount(sessionCount: number): number {
  let bonus = 0
  for (let i = 0; i < sessionCount; i++) {
    const idx = Math.min(i, RECURRENCE_SESSION_BONUS.length - 1)
    bonus += RECURRENCE_SESSION_BONUS[idx] ?? 10
  }
  return bonus
}

// ─────────────────────────────────────────────────────────────────────────────
// totalRecurrenceBonus
//
// Agrega o bônus de recorrência para múltiplos tutores.
// Recebe um Map de tutorId → sessionCount.
// ─────────────────────────────────────────────────────────────────────────────

export function totalRecurrenceBonus(sessionsByTutor: Map<string, number>): number {
  let total = 0
  for (const count of sessionsByTutor.values()) {
    total += recurrenceBonusForCount(count)
  }
  return total
}

// ─────────────────────────────────────────────────────────────────────────────
// round1
//
// Utilitário para arredondar valores do breakdown a 1 casa decimal.
// ─────────────────────────────────────────────────────────────────────────────

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
