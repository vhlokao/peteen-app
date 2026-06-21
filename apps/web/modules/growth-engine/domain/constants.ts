/**
 * módulo: growth-engine
 * camada: domain — constantes e labels
 */

import type { HealthClassification } from "./types"

/** Cada pilar contribui até 20 pts → Health Score 0–100 */
export const METRIC_COMPONENT_MAX = 20

export const HEALTH_CLASSIFICATION_LABELS: Record<HealthClassification, string> = {
  INICIAR:    "Iniciar",
  CRESCENDO:  "Crescendo",
  FORTE:      "Forte",
  DOMINANTE:  "Dominante",
}

export const HEALTH_CLASSIFICATION_RANGES: Array<{
  min: number
  max: number
  classification: HealthClassification
}> = [
  { min: 0,  max: 25, classification: "INICIAR" },
  { min: 26, max: 50, classification: "CRESCENDO" },
  { min: 51, max: 75, classification: "FORTE" },
  { min: 76, max: 100, classification: "DOMINANTE" },
]

/** Recommendation Engine — bônus local (Etapa 6.0) */
export const LOCAL_BONUS_SAME_NEIGHBORHOOD = 10
export const LOCAL_BONUS_SAME_REGION       = 5
export const LOCAL_BONUS_MAX               = 10

/** Thresholds internos para normalizar contagem → score 0–20 */
export const SUPPLY_THRESHOLDS   = [1, 3, 6, 10, 15, 25]
export const DEMAND_THRESHOLDS   = [1, 5, 10, 20, 40, 80]
export const PARTNER_THRESHOLDS  = [1, 2, 4, 6, 10, 15]
export const RECURRENCE_TRUSTED_THRESHOLD = 0.35
