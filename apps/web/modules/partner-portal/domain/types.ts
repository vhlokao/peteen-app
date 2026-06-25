/**
 * Módulo: partner-portal
 * Camada: domain — tipos puros
 */

import type {
  Partner,
  PartnerCategory,
  PartnerVerificationStatus,
} from "@/modules/partners/domain/types"

export type PartnerPortalProfile = Pick<
  Partner,
  | "id"
  | "businessName"
  | "slug"
  | "category"
  | "city"
  | "state"
  | "description"
  | "phone"
  | "website"
  | "logoUrl"
  | "verificationStatus"
  | "isVerified"
>

export type PartnerDashboardStats = {
  recommendedProfessionals: number
  activeRecommendations: number
  verifiedRecommended: number
  activeConnections: number
  trustConnectionsGenerated: number
  verificationStatus: PartnerVerificationStatus
}

export type PartnerMetricsData = {
  totalRecommendations: number
  activeRecommendations: number
  verifiedRecommended: number
  recurringRecommended: number
  activeConnections: number
  verificationStatus: PartnerVerificationStatus
  isVerified: boolean
}

export type PartnerActivityType =
  | "recommendation.created"
  | "recommendation.removed"
  | "verification.approved"
  | "connection.active"
  | "professional.recurring"

export type PartnerActivityItem = {
  id: string
  type: PartnerActivityType
  title: string
  description: string
  occurredAt: Date
  href: string | null
}

export type PartnerNextAction = {
  id: string
  label: string
  description: string
  href: string
  variant: "default" | "outline"
}

export type PartnerRecommendationGroup = {
  professionalId: string
  displayName: string
  city: string
  specialty: string
  publicProfileHref: string
  isConnectionActive: boolean
  recommendations: Array<{
    connectionId: string
    recommendedAt: Date
    isActive: boolean
    statusLabel: string
  }>
}

/** Linha plana para gestão de recomendações (Etapa 7.2) */
export type PartnerRecommendationRow = {
  connectionId: string
  professionalId: string
  displayName: string
  city: string
  specialty: string
  isActive: boolean
  statusLabel: "Ativa" | "Inativa"
  recommendedAt: Date
  publicProfileHref: string
}

export type ProfessionalSearchResult = {
  id: string
  displayName: string
  city: string
  specialty: string
  trustScore: number
}

export type PartnerPortalData = {
  partner: PartnerPortalProfile
  stats: PartnerDashboardStats
  recentActivity: PartnerActivityItem[]
  nextActions: PartnerNextAction[]
}

export type UpdatePartnerPortalProfileInput = {
  businessName: string
  description?: string
  city: string
  state: string
  phone?: string
  category: PartnerCategory
  website?: string
  logoUrl?: string
}
