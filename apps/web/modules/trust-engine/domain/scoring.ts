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
} from "./constants.ts"

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
// countEligibleCompletions
//
// Quantas conclusões de UM par tutor-profissional contam para o bônus de
// recorrência. Diferente do número real de atendimentos: no máximo uma
// conclusão gera crédito reputacional dentro de cada janela.
//
// Por que existir:
//   `completedServices` é dado operacional bruto — o número verdadeiro de
//   atendimentos, e deve continuar sendo. Mas usá-lo direto no bônus de
//   recorrência deixava o maior ganho reputacional do motor (+1/+3/+5/+7/+10
//   por sessão) exposto a conclusões repetidas do mesmo par em poucas horas.
//   Aqui a contagem é DERIVADA dos instantes reais de conclusão, então:
//     - nenhuma conclusão é escondida, apagada ou deixa de existir;
//     - o antifraude segue contando todas (ele lê ServiceRequest direto);
//     - o resultado é idempotente e recalculável a qualquer momento.
//
// Semântica da janela (deslizante a partir do último CRÉDITO):
//   A janela reinicia apenas quando uma conclusão de fato recebe crédito.
//   Uma conclusão não elegível NÃO empurra o relógio para frente — senão um
//   par poderia adiar indefinidamente o próximo crédito (ou, pior, encadear
//   conclusões a cada 23h para nunca mais creditar ninguém).
//
//   Exemplo (janela de 24h):
//     08:00 dia 1 → elegível   (crédito; relógio = 08:00 dia 1)
//     14:00 dia 1 → só operacional, sem crédito (relógio continua 08:00 dia 1)
//     08:01 dia 2 → elegível novamente (passaram 24h01 do último crédito)
// ─────────────────────────────────────────────────────────────────────────────

export function countEligibleCompletions(
  completedAt: readonly Date[],
  windowMs: number
): number {
  const ordered = [...completedAt]
    .map((d) => d.getTime())
    .sort((a, b) => a - b)

  let eligible = 0
  let lastCreditedAt: number | null = null

  for (const at of ordered) {
    if (lastCreditedAt === null || at - lastCreditedAt >= windowMs) {
      eligible++
      lastCreditedAt = at
    }
  }

  return eligible
}

/**
 * Aplica `countEligibleCompletions` a vários tutores de uma vez e devolve o
 * mapa tutorId → contagem elegível, no formato que `totalRecurrenceBonus`
 * já consome.
 */
export function eligibleSessionsByTutor(
  completionsByTutor: Map<string, Date[]>,
  windowMs: number
): Map<string, number> {
  const result = new Map<string, number>()
  for (const [tutorId, dates] of completionsByTutor) {
    result.set(tutorId, countEligibleCompletions(dates, windowMs))
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// round1
//
// Utilitário para arredondar valores do breakdown a 1 casa decimal.
// ─────────────────────────────────────────────────────────────────────────────

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
