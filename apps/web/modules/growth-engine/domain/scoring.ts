/**
 * módulo: growth-engine
 * camada: domain — funções puras de scoring territorial
 */

import {
  METRIC_COMPONENT_MAX,
  HEALTH_CLASSIFICATION_RANGES,
  LOCAL_BONUS_SAME_NEIGHBORHOOD,
  LOCAL_BONUS_SAME_REGION,
  LOCAL_BONUS_MAX,
  SUPPLY_THRESHOLDS,
  DEMAND_THRESHOLDS,
  PARTNER_THRESHOLDS,
} from "./constants"
import type { HealthClassification, TerritoryMetrics } from "./types"

/** Normaliza contagem em escala 0–20 usando degraus */
export function normalizeCountScore(count: number, thresholds: number[]): number {
  if (count <= 0) return 0
  let score = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (count >= thresholds[i]!) {
      score = Math.round(((i + 1) / thresholds.length) * METRIC_COMPONENT_MAX)
    }
  }
  return Math.min(METRIC_COMPONENT_MAX, score)
}

/** Trust médio 0–100 → componente 0–20 */
export function normalizeTrustScore(avgTrust: number): number {
  const clamped = Math.max(0, Math.min(100, avgTrust))
  return Math.round((clamped / 100) * METRIC_COMPONENT_MAX)
}

/** Recorrência média 0–1 (ratio) → componente 0–20 */
export function normalizeRecurrenceScore(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio))
  return Math.round(clamped * METRIC_COMPONENT_MAX)
}

export function computeTerritoryMetrics(input: {
  professionalCount: number
  requestCount:      number
  trustAvg:          number
  recurrenceRatio:   number
  partnerCount:      number
}): TerritoryMetrics {
  return {
    supplyScore:     normalizeCountScore(input.professionalCount, SUPPLY_THRESHOLDS),
    demandScore:     normalizeCountScore(input.requestCount, DEMAND_THRESHOLDS),
    trustScore:      normalizeTrustScore(input.trustAvg),
    recurrenceScore: normalizeRecurrenceScore(input.recurrenceRatio),
    partnerDensity:  normalizeCountScore(input.partnerCount, PARTNER_THRESHOLDS),
  }
}

export function computeHealthScore(metrics: TerritoryMetrics): number {
  const raw =
    metrics.supplyScore +
    metrics.demandScore +
    metrics.trustScore +
    metrics.recurrenceScore +
    metrics.partnerDensity
  return Math.max(0, Math.min(100, raw))
}

export function classifyHealthScore(score: number): HealthClassification {
  const clamped = Math.max(0, Math.min(100, score))
  for (const range of HEALTH_CLASSIFICATION_RANGES) {
    if (clamped >= range.min && clamped <= range.max) {
      return range.classification
    }
  }
  return "DOMINANTE"
}

/** Converte health 0–100 em estrelas 1–5 para heatmap textual */
export function healthToStars(healthScore: number): number {
  if (healthScore <= 0) return 1
  return Math.max(1, Math.min(5, Math.ceil(healthScore / 20)))
}

export function renderStarRating(stars: number): string {
  const filled = Math.max(0, Math.min(5, stars))
  return "★".repeat(filled) + "☆".repeat(5 - filled)
}

/** Bônus local para Recommendation Engine — cap +10 */
export function computeLocalRecommendationBonus(input: {
  tutorNeighborhood:     string | null
  tutorRegionId:         string | null
  professionalNeighborhood: string | null
  professionalRegionId:  string | null
  tutorNeighborhoodId:   string | null
  professionalNeighborhoodId: string | null
}): { points: number; label: string | null } {
  const sameNeighborhood =
    (input.tutorNeighborhoodId && input.professionalNeighborhoodId &&
      input.tutorNeighborhoodId === input.professionalNeighborhoodId) ||
    (input.tutorNeighborhood && input.professionalNeighborhood &&
      input.tutorNeighborhood.toLowerCase().trim() ===
      input.professionalNeighborhood.toLowerCase().trim())

  if (sameNeighborhood) {
    return {
      points: Math.min(LOCAL_BONUS_MAX, LOCAL_BONUS_SAME_NEIGHBORHOOD),
      label:  "Mesmo bairro",
    }
  }

  const sameRegion =
    input.tutorRegionId &&
    input.professionalRegionId &&
    input.tutorRegionId === input.professionalRegionId

  if (sameRegion) {
    return {
      points: Math.min(LOCAL_BONUS_MAX, LOCAL_BONUS_SAME_REGION),
      label:  "Mesma região",
    }
  }

  return { points: 0, label: null }
}

export function slugifyTerritory(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
