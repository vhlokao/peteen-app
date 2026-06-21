/**
 * Módulo: relationship-history
 * Camada: domain — Etapa 6.6 Relationship & History Layer
 */

import type { ProfessionalVerificationStatus } from "@/modules/professional-crm/domain/types"

export type RelationshipPetRow = {
  petId: string
  petName: string
  species: string
  attendanceCount: number
  lastServiceAt: Date | null
}

export type RelationshipRequestRow = {
  id: string
  status: string
  statusLabel: string
  serviceType: string
  serviceLabel: string
  petName: string | null
  occurredAt: Date
  href: string
}

export type RelationshipReviewRow = {
  id: string
  rating: number
  comment: string | null
  createdAt: Date
  authorName: string
}

export type RelationshipSummary = {
  completedServices: number
  totalRequests: number
  lastServiceAt: Date | null
  relationshipLevel: string
  relationshipLevelLabel: string
  isRecurring: boolean
}

export type ProfessionalClientHistory = {
  tutor: {
    id: string
    displayName: string
    city: string
    neighborhood: string | null
  }
  summary: RelationshipSummary
  pets: RelationshipPetRow[]
  requests: RelationshipRequestRow[]
  reviews: RelationshipReviewRow[]
}

export type TutorProfessionalHistory = {
  professional: {
    id: string
    displayName: string
    city: string
    avatarUrl: string | null
    trustScore: number
    verificationStatus: ProfessionalVerificationStatus
  }
  summary: RelationshipSummary & {
    lastHiredAt: Date | null
  }
  pets: RelationshipPetRow[]
  requests: RelationshipRequestRow[]
  reviews: RelationshipReviewRow[]
}
