"use server"

/**
 * Módulo: notifications
 * Camada: application — leitura com guards de ownership
 */

import { getAuthContext, requireAdmin } from "@/modules/identity/application/get-session"
import { findProfessionalProfileByUserId } from "@/modules/professional/infrastructure/repository"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { findOwnedPartnerForUser } from "@/modules/partner-portal/infrastructure/repository"
import { requireTutorContext } from "@/modules/relationship-history/application/require-tutor"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import type { NotificationItem } from "../domain/types"
import {
  countAdminNotifications,
  countPartnerNotifications,
  countProfessionalNotifications,
  countTutorNotifications,
  getAdminNotifications,
  getPartnerNotifications,
  getProfessionalNotifications,
  getTutorNotifications,
} from "../infrastructure/queries"

export async function getTutorNotificationsAction(): Promise<NotificationItem[]> {
  const { profile } = await requireTutorContext()
  return getTutorNotifications(profile.id)
}

export async function getProfessionalNotificationsAction(): Promise<NotificationItem[]> {
  const { profile } = await requireProfessionalContext()
  return getProfessionalNotifications(profile.id)
}

export async function getPartnerNotificationsAction(): Promise<NotificationItem[]> {
  const { partner } = await requirePartnerContext()
  return getPartnerNotifications(partner.id)
}

export async function getAdminNotificationsAction(): Promise<NotificationItem[]> {
  await requireAdmin()
  return getAdminNotifications()
}

export async function getTutorNotificationCountAction(): Promise<number> {
  const { profile } = await requireTutorContext()
  return countTutorNotifications(profile.id)
}

export async function getProfessionalNotificationCountAction(): Promise<number> {
  const { profile } = await requireProfessionalContext()
  return countProfessionalNotifications(profile.id)
}

export async function getPartnerNotificationCountAction(): Promise<number> {
  const { partner } = await requirePartnerContext()
  return countPartnerNotifications(partner.id)
}

/**
 * Contador para layout — não redireciona visitantes de /discover (parceiro, profissional, etc.)
 *
 * Sem sessão de aplicação devolve 0 em vez de lançar: este contador roda no
 * render do layout, onde um throw viraria stack trace de fluxo esperado. É a
 * mesma degradação graciosa que já era feita para persona errada / sem perfil —
 * a autorização real de cada rota continua na página e no middleware.
 */
export async function getTutorNotificationCountForLayoutAction(): Promise<number> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) return 0
  const session = ctx.user
  if (!session.roles.includes("TUTOR")) return 0
  const profile = await findTutorProfileByUserId(session.id)
  if (!profile) return 0
  return countTutorNotifications(profile.id)
}

/** Contador para layout — não redireciona outras personas (ver nota acima sobre sessão ausente) */
export async function getProfessionalNotificationCountForLayoutAction(): Promise<number> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) return 0
  const session = ctx.user
  if (!session.roles.includes("PROFESSIONAL")) return 0
  const profile = await findProfessionalProfileByUserId(session.id)
  if (!profile) return 0
  return countProfessionalNotifications(profile.id)
}

/** Contador para layout — não redireciona em /partner/pending (ver nota acima sobre sessão ausente) */
export async function getPartnerNotificationCountForLayoutAction(): Promise<number> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) return 0
  const session = ctx.user
  const owned = await findOwnedPartnerForUser(session.id)
  if (
    !owned ||
    !owned.partnerProfile.linkedPartnerId ||
    owned.partnerProfile.linkedPartnerId !== owned.partner.id
  ) {
    return 0
  }
  return countPartnerNotifications(owned.partner.id)
}

export async function getAdminNotificationCountAction(): Promise<number> {
  await requireAdmin()
  return countAdminNotifications()
}
