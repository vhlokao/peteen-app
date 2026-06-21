/**
 * Módulo: reputation-badges
 * Camada: domain — thresholds e metadados visuais
 */

import { ANALYTICS_THRESHOLDS } from "@/modules/relationship/domain/constants"
import type { ReputationBadgeType } from "./types"

export const REPUTATION_THRESHOLDS = {
  RECURRING_RELATIONSHIP: ANALYTICS_THRESHOLDS.RECURRING,
  HIGHLY_RATED_MIN_REVIEWS: 5,
  HIGHLY_RATED_MIN_AVERAGE: 4.8,
  EXPERIENCED_MIN_SERVICES: 10,
} as const

export const REPUTATION_BADGE_META: Record<
  ReputationBadgeType,
  { label: string; description: string; className: string }
> = {
  verified: {
    label: "Verificado",
    description: "Perfil com verificação operacional ativa",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  recurring_client: {
    label: "Cliente recorrente",
    description: "Relacionamento com 3 ou mais atendimentos concluídos",
    className:
      "border-emerald-700/30 bg-emerald-800/15 text-emerald-800 dark:text-emerald-300",
  },
  highly_rated: {
    label: "Bem avaliado",
    description: "5 ou mais reviews com média ≥ 4,8",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  experienced: {
    label: "Experiente",
    description: "10 ou mais serviços concluídos",
    className:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  recommended: {
    label: "Recomendado",
    description: "Possui recomendação ativa na rede de confiança",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
}

/** Ordem de exibição nos cards */
export const REPUTATION_BADGE_PRIORITY: ReputationBadgeType[] = [
  "verified",
  "recommended",
  "experienced",
  "highly_rated",
  "recurring_client",
]
