/**
 * Módulo: reputation-badges
 * Camada: domain — Etapa 6.7 Badges & Reputation Visualization
 *
 * Somente leitura. Sem gamificação. Legibilidade de confiança.
 */

import type { ProfessionalVerificationStatus } from "@/modules/professional-crm/domain/types"

export type ReputationBadgeType =
  | "verified"
  | "recurring_client"
  | "highly_rated"
  | "experienced"
  | "recommended"

export type ReputationBadge = {
  type: ReputationBadgeType
  label: string
  description: string
}

/** Dados brutos para resolver badges — sem IO */
export type ReputationSnapshot = {
  professionalId: string
  trustScore: number
  verificationActive: boolean
  completedServices: number
  reviewCount: number
  averageRating: number | null
  /** Relacionamentos com completedServices >= 3 */
  recurringClientsCount: number
  /** TrustConnections ativas apontando para o profissional */
  activeRecommendationsCount: number
  /** Visão tutor: completedServices do relacionamento pessoal (opcional) */
  viewerRelationshipCompletedServices?: number
}

export type ReputationTrustSummary = {
  trustScore: number
  totalReviews: number
  averageRating: number | null
  recurringClientsCount: number
  completedServices: number
  recommendationsCount: number
  verificationStatus: ProfessionalVerificationStatus
  verificationLabel: string
  badges: ReputationBadge[]
}
