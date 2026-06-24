"use server"

/**
 * Módulo: activity-center
 * Camada: application — leitura com guards de ownership
 */

import { requireAdmin } from "@/modules/identity/application/get-session"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { requireTutorContext } from "@/modules/relationship-history/application/require-tutor"
import type { ActivityItem } from "../domain/types"
import {
  getAdminActivityFeed,
  getPartnerActivityFeed,
  getProfessionalActivityFeed,
  getTutorActivityFeed,
} from "../infrastructure/queries"

export async function getTutorActivityFeedAction(): Promise<ActivityItem[]> {
  const { profile, session } = await requireTutorContext()
  return getTutorActivityFeed(profile.id, session.id)
}

export async function getProfessionalActivityFeedAction(): Promise<ActivityItem[]> {
  const { profile, session } = await requireProfessionalContext()
  return getProfessionalActivityFeed(profile.id, session.id, profile)
}

export async function getPartnerActivityFeedAction(): Promise<ActivityItem[]> {
  const { partner, session } = await requirePartnerContext()
  return getPartnerActivityFeed(partner.id, session.id)
}

export async function getAdminActivityFeedAction(): Promise<ActivityItem[]> {
  await requireAdmin()
  return getAdminActivityFeed()
}
