/**
 * Módulo: professional-crm
 * Camada: domain — Etapa 6.5 Professional Portal & CRM Foundation
 */

import type { TrustLevel } from "@/modules/professional/domain/types"

export type ProfessionalDashboardStats = {
  receivedRequests: number
  inProgressRequests: number
  completedServices: number
  uniqueClients: number
  petsAttended: number
  reviewsReceived: number
  trustScore: number
}

export type ProfessionalActivityType =
  | "request.received"
  | "request.accepted"
  | "service.completed"
  | "review.received"
  | "recurrence.new"
  | "verification.approved"
  | "verification.suspended"
  | "verification.pending"
  | "recommendation.received"

export type ProfessionalActivityItem = {
  id: string
  type: ProfessionalActivityType
  title: string
  description: string
  occurredAt: Date
  href: string
}

export type ProfessionalNextAction = {
  id: string
  label: string
  description: string
  href: string
  variant: "default" | "outline"
}

export type ProfessionalClientRow = {
  tutorId: string
  tutorName: string
  city: string
  totalServices: number
  lastServiceAt: Date | null
  petNames: string[]
  relationshipLevel: string
  relationshipLevelLabel: string
}

export type ProfessionalPetRow = {
  petId: string
  petName: string
  species: string
  tutorId: string
  tutorName: string
  attendanceCount: number
  lastServiceAt: Date | null
}

export type ProfessionalReviewRow = {
  id: string
  tutorId: string
  tutorName: string
  rating: number
  comment: string | null
  createdAt: Date
  requestId: string
  serviceType: string | null
  petName: string | null
}

export type ProfessionalReviewsData = {
  averageRating: number | null
  totalReviews: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  reviews: ProfessionalReviewRow[]
}

export type ProfessionalVerificationStatus =
  | "verified"
  | "pending"
  | "suspended"
  | "not_verified"

export type ProfessionalMetricsData = {
  stats: ProfessionalDashboardStats & {
    recommendationsReceived: number
    recurringClients: number
    verificationStatus: ProfessionalVerificationStatus
  }
  trustLevel: TrustLevel
  trustLevelLabel: string
}

export type ProfessionalPortalData = {
  stats: ProfessionalDashboardStats
  recentActivity: ProfessionalActivityItem[]
  nextActions: ProfessionalNextAction[]
}
