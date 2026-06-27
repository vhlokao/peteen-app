/**
 * Módulo: activity-center
 * Camada: domain — tipos puros da central de atividades
 */

export type ActivityType =
  | "request_created"
  | "request_accepted"
  | "request_completed"
  | "review_received"
  | "review_sent"
  | "relationship_recurring"
  | "verification_approved"
  | "verification_suspended"
  | "verification_reactivated"
  | "professional_recommended"
  | "pet_created"
  | "pet_archived"
  | "profile_updated"
  | "connection_active"
  | "recommendation_active"
  | "partner_verified"
  | "verification_rejected"
  | "review_hidden"
  | "review_restored"
  | "partner_activated"
  | "partner_deactivated"
  | "admin_action"
  | "dispute_opened"
  | "dispute_received"
  | "dispute_pending"

export type ActivityEntityType =
  | "ServiceRequest"
  | "Review"
  | "Pet"
  | "TutorProfile"
  | "ProfessionalProfile"
  | "Partner"
  | "TrustConnection"
  | "VerificationRequest"
  | "TutorProfessionalRelationship"
  | "AdminAuditLog"
  | "AuditLog"
  | "Dispute"
  | string

export type ActivityItem = {
  id: string
  type: ActivityType
  title: string
  description: string
  createdAt: Date
  entityId: string
  entityType: ActivityEntityType
  href?: string
  actorName?: string
  metadata?: Record<string, unknown>
}

export type ActivityFeedConfig = {
  emptyTitle: string
  emptyDescription: string
}

export const TUTOR_ACTIVITY_EMPTY: ActivityFeedConfig = {
  emptyTitle: "Nenhuma atividade ainda",
  emptyDescription:
    "Quando você solicitar ou avaliar um atendimento, tudo aparecerá aqui.",
}

export const PROFESSIONAL_ACTIVITY_EMPTY: ActivityFeedConfig = {
  emptyTitle: "Nenhuma atividade ainda",
  emptyDescription:
    "Quando tutores interagirem com seus serviços, você verá aqui.",
}

export const PARTNER_ACTIVITY_EMPTY: ActivityFeedConfig = {
  emptyTitle: "Nenhuma atividade ainda",
  emptyDescription:
    "Quando sua rede gerar conexões, tudo aparecerá aqui.",
}

export const ADMIN_ACTIVITY_EMPTY: ActivityFeedConfig = {
  emptyTitle: "Nenhuma atividade operacional encontrada",
  emptyDescription:
    "Eventos de verificação, moderação e auditoria aparecerão aqui.",
}
