/**
 * Módulo: notifications
 * Camada: domain — tipos da central de notificações (MVP 7.5, derivadas)
 */

export type NotificationType =
  | "request_received"
  | "request_accepted"
  | "request_completed"
  | "request_cancelled"
  | "review_received"
  | "review_pending"
  | "dispute_opened"
  | "dispute_status_updated"
  | "verification_pending"
  | "verification_approved"
  | "recommendation_received"
  | "partner_recommendation_activity"
  | "client_recurring"
  | "risk_flag"
  | "review_hidden"
  | "partner_unlinked"
  | "admin_attention"

export type NotificationPriority = "high" | "normal"

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  description: string
  createdAt: Date
  href?: string
  /** Sem persistência no schema — sempre omitido no MVP */
  isRead?: boolean
  priority?: NotificationPriority
  entityId?: string
  entityType?: string
}

export type NotificationFeedConfig = {
  emptyTitle: string
  emptyDescription: string
}

export const TUTOR_NOTIFICATIONS_EMPTY: NotificationFeedConfig = {
  emptyTitle: "Nenhuma notificação recente",
  emptyDescription:
    "Quando houver atualizações nas suas solicitações ou disputas, elas aparecerão aqui.",
}

export const PROFESSIONAL_NOTIFICATIONS_EMPTY: NotificationFeedConfig = {
  emptyTitle: "Nenhuma notificação recente",
  emptyDescription:
    "Novas solicitações, avaliações e disputas serão exibidas aqui.",
}

export const PARTNER_NOTIFICATIONS_EMPTY: NotificationFeedConfig = {
  emptyTitle: "Nenhuma notificação recente",
  emptyDescription:
    "Atividade da sua rede de profissionais recomendados aparecerá aqui.",
}

export const ADMIN_NOTIFICATIONS_EMPTY: NotificationFeedConfig = {
  emptyTitle: "Nenhuma pendência operacional",
  emptyDescription:
    "Disputas, verificações e flags que exigem atenção aparecerão aqui.",
}
