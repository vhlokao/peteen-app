/**
 * módulo: relationship
 * camada: domain — funções puras
 *
 * Zero dependências externas. Zero acesso ao banco.
 * Toda lógica de nível, score e badges é determinística e testável de forma isolada.
 */

import type { RelationshipLevel } from "./types"
import {
  RELATIONSHIP_LEVEL_THRESHOLDS,
  RELATIONSHIP_SCORE_WEIGHTS,
  RELATIONSHIP_BADGES,
  type RelationshipBadgeId,
} from "./constants"

// ─────────────────────────────────────────────────────────────────────────────
// resolveRelationshipLevel
//
// Determina o nível com base em completedServices.
// O nível é SEMPRE baseado em atendimentos concluídos — nunca em score.
// Isso garante que a recorrência real (comportamento) define o vínculo,
// não a nota ou a avaliação (percepção).
// ─────────────────────────────────────────────────────────────────────────────

export function resolveRelationshipLevel(completedServices: number): RelationshipLevel {
  if (completedServices >= RELATIONSHIP_LEVEL_THRESHOLDS.PARTNER)    return "PARTNER"
  if (completedServices >= RELATIONSHIP_LEVEL_THRESHOLDS.TRUSTED)    return "TRUSTED"
  if (completedServices >= RELATIONSHIP_LEVEL_THRESHOLDS.RECURRING)  return "RECURRING"
  if (completedServices >= RELATIONSHIP_LEVEL_THRESHOLDS.KNOWN)      return "KNOWN"
  if (completedServices >= RELATIONSHIP_LEVEL_THRESHOLDS.NEW)        return "NEW"
  // 0 atendimentos = nenhum relacionamento ainda
  return "NEW"
}

// ─────────────────────────────────────────────────────────────────────────────
// computeRelationshipScore
//
// Score interno do relacionamento. Não é exibido diretamente ao usuário,
// mas alimenta o Trust Engine e o Ranking Engine.
//
// Mínimo: 0 — um relacionamento nunca é "negativo", apenas mais fraco.
// Máximo: sem limite, mas normalizado externamente se necessário.
// ─────────────────────────────────────────────────────────────────────────────

export function computeRelationshipScore(params: {
  completedServices: number
  reviewsGiven:      number
  cancelledByTutor:  number
  cancelledByPro:    number
  disputedServices:  number
}): number {
  const raw =
    params.completedServices * RELATIONSHIP_SCORE_WEIGHTS.SERVICE_COMPLETED +
    params.reviewsGiven      * RELATIONSHIP_SCORE_WEIGHTS.REVIEW_GIVEN      +
    params.cancelledByTutor  * RELATIONSHIP_SCORE_WEIGHTS.CANCELLATION_BY_TUTOR +
    params.cancelledByPro    * RELATIONSHIP_SCORE_WEIGHTS.CANCELLATION_BY_PRO   +
    params.disputedServices  * RELATIONSHIP_SCORE_WEIGHTS.DISPUTE

  // Score nunca negativo — relacionamento fraco ≠ relacionamento ruim
  return Math.max(0, Math.round(raw * 10) / 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// getEarnedBadges
//
// Retorna os IDs dos badges conquistados com base em completedServices.
// Determinístico — sem banco, sem estado.
// ─────────────────────────────────────────────────────────────────────────────

export function getEarnedBadges(completedServices: number): RelationshipBadgeId[] {
  return (Object.keys(RELATIONSHIP_BADGES) as RelationshipBadgeId[]).filter((key) => {
    const badge = RELATIONSHIP_BADGES[key]
    if (completedServices < badge.minServices) return false
    if (badge.maxServices !== null && completedServices > badge.maxServices) return false
    return true
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// formatServiceCount — helpers de UI
// ─────────────────────────────────────────────────────────────────────────────

export function formatServiceCount(count: number): string {
  if (count === 1) return "1 vez"
  return `${count} vezes`
}

export function formatRelationshipSummary(
  displayName: string,
  completedServices: number
): string {
  if (completedServices === 0) return ""
  return `Você já contratou ${displayName} ${formatServiceCount(completedServices)}.`
}
