/**
 * Módulo: tutor-portal
 * Camada: domain — Etapa 6.4 Tutor Portal Foundation
 */

import type { ServiceType } from "@/modules/professional/domain/types"

export type TutorDashboardStats = {
  activePets: number
  openRequests: number
  completedRequests: number
  hiredProfessionals: number
  reviewsGiven: number
  totalRequests: number
  pendingReviews: number
}

export type TutorActivityType =
  | "pet.created"
  | "request.created"
  | "request.accepted"
  | "request.completed"
  | "review.created"

export type TutorActivityItem = {
  id: string
  type: TutorActivityType
  title: string
  description: string
  occurredAt: Date
  href: string
}

export type TutorNextAction = {
  id: string
  label: string
  description: string
  href: string
  variant: "default" | "outline"
}

export type HiredProfessionalSummary = {
  professionalId: string
  displayName: string
  city: string
  avatarUrl: string | null
  lastServiceType: ServiceType
  totalServices: number
  lastHiredAt: Date
}

export type TutorPortalData = {
  stats: TutorDashboardStats
  recentActivity: TutorActivityItem[]
  nextActions: TutorNextAction[]
  hiredProfessionals: HiredProfessionalSummary[]
  firstPendingReviewRequestId: string | null
}
