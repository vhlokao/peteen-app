/**
 * módulo: trust-engine
 * camada: domain — constantes
 *
 * Pesos e limiares são dados, não código.
 * Todos os parâmetros do motor estão aqui.
 * Nada hardcoded no código de cálculo.
 *
 * Para ajustar o comportamento do Trust Engine:
 *   1. Altere aqui.
 *   2. Rode recalculateTrustForAllProfessionals() (Fase 6).
 *   3. A mudança se propaga para todos os profissionais.
 */

import type { TrustEventType } from "@/modules/service-request/domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// SCORE BOUNDS
// ─────────────────────────────────────────────────────────────────────────────

export const TRUST_SCORE_MIN = 0
export const TRUST_SCORE_MAX = 100

// ─────────────────────────────────────────────────────────────────────────────
// TRUST LEVEL THRESHOLDS
//
// Mapeamento score → TrustLevel (enum do Prisma: INITIAL, BUILDING, ESTABLISHED, TRUSTED, ELITE)
// Labels em português definidos em modules/professional/domain/types.ts
// ─────────────────────────────────────────────────────────────────────────────

export const TRUST_LEVEL_THRESHOLDS = [
  { level: "ELITE",       min: 81 },
  { level: "TRUSTED",     min: 61 },
  { level: "ESTABLISHED", min: 41 },
  { level: "BUILDING",    min: 21 },
  { level: "INITIAL",     min: 0  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// RECORRÊNCIA — peso progressivo por sessão com o mesmo tutor
//
// Índice 0 = 1ª sessão, índice 1 = 2ª sessão, etc.
// Índices além do array usam o último valor (10).
//
// Conceito: a mesma pessoa voltar vale mais do que uma nova avaliação.
// Cada sessão incremental com o mesmo tutor acumula o bônus correspondente.
// ─────────────────────────────────────────────────────────────────────────────

export const RECURRENCE_SESSION_BONUS = [1, 3, 5, 7, 10] as const
// Índices:  [0] [1] [2] [3] [4+]
// Sessão:    1ª  2ª  3ª  4ª  5ª+

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIZAÇÃO DE TRUST EVENTS
//
// Indica qual categoria de breakdown cada tipo de evento alimenta.
// Os pesos reais já estão nos registros de TrustEvent no banco.
// ─────────────────────────────────────────────────────────────────────────────

export const REVIEW_EVENT_TYPES: readonly TrustEventType[] = [
  "REVIEW_POSITIVE",
  "REVIEW_NEUTRAL",
  "REVIEW_NEGATIVE",
]

export const COMPLETION_EVENT_TYPES: readonly TrustEventType[] = [
  "RECURRENCE_COMPLETED",
]

export const BONUS_EVENT_TYPES: readonly TrustEventType[] = [
  "RECOMMENDATION",
  "IDENTITY_VERIFIED",
  "FRAUD_FLAG_RESOLVED",
]

export const PENALTY_EVENT_TYPES: readonly TrustEventType[] = [
  "CANCELLATION_BY_PRO",
  "CANCELLATION_BY_TUTOR",
  "FRAUD_FLAG",
]

// ─────────────────────────────────────────────────────────────────────────────
// PESOS DE REFERÊNCIA (documentação — não usados no cálculo)
//
// Os pesos reais estão nos registros de TrustEvent criados pelas actions.
// Esta seção serve como documentação dos valores em produção.
// ─────────────────────────────────────────────────────────────────────────────

export const REFERENCE_WEIGHTS = {
  // Reviews
  REVIEW_5_STAR:                +3.5,
  REVIEW_4_STAR:                +2.0,
  REVIEW_3_STAR:                +0.5,
  REVIEW_2_STAR:                -2.5,
  REVIEW_1_STAR:                -4.0,
  // Conclusões
  RECURRENCE_COMPLETED:         +1.5,
  // Bônus
  RECOMMENDATION:               +4.0,
  IDENTITY_VERIFIED:            +3.0,
  // Penalidades
  CANCELLATION_BEFORE_START:    -2.0,
  CANCELLATION_AFTER_CONFIRM:   -4.0,
  FRAUD_FLAG:                   -20.0,
} as const
