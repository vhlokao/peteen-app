/**
 * Módulo: notifications
 * Camada: infrastructure — rotas de destino por persona (BUG 7.5)
 */

import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"

export const NOTIFICATION_FALLBACK = {
  tutor: "/tutor/notifications",
  professional: "/professional/notifications",
  partner: "/partner/notifications",
  admin: "/admin/notifications",
} as const

export const tutorNotificationHref = {
  request(requestId?: string | null): string {
    return requestId
      ? `/tutor/requests/${requestId}`
      : NOTIFICATION_FALLBACK.tutor
  },
  professional(professionalId?: string | null): string {
    return professionalId
      ? `/tutor/professionals/${professionalId}`
      : NOTIFICATION_FALLBACK.tutor
  },
}

export const professionalNotificationHref = {
  request(requestId?: string | null): string {
    return requestId ? `/requests/${requestId}` : NOTIFICATION_FALLBACK.professional
  },
  reviews: "/professional/reviews",
  client(tutorId?: string | null): string {
    return tutorId
      ? `/professional/clients/${tutorId}`
      : NOTIFICATION_FALLBACK.professional
  },
  metricas: "/professional/metricas",
  activity: "/professional/activity",
}

export const partnerNotificationHref = {
  recommendations: "/partner/recommendations",
  metrics: "/partner/metrics",
  profile: "/partner/profile",
  discoverProfessional(professionalId?: string | null): string {
    if (!professionalId) return NOTIFICATION_FALLBACK.partner
    return buildDiscoverUrl(professionalId, {
      from: "partner",
      returnTo: NOTIFICATION_FALLBACK.partner,
    })
  },
}

export const adminNotificationHref = {
  disputes: "/admin/disputes",
  verifications: "/admin/verifications",
  reviews: "/admin/reviews",
  flags: "/admin/flags",
  partners: "/admin/partners",
  audit: "/admin/audit",
}
