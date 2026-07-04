/**
 * Módulo: partner-portal
 * Camada: application — guard de acesso para rotas do parceiro
 */

import { redirect } from "next/navigation"

import { requireAuth } from "@/modules/identity/application/get-session"
import { resolveHomeForRoles } from "@/modules/identity/domain/role-routing"
import type { SessionUser } from "@/modules/identity/domain/types"
import type { Partner } from "@/modules/partners/domain/types"
import {
  findOwnedPartnerForUser,
  findPartnerProfileByUserId,
  type PartnerProfileLink,
} from "../infrastructure/repository"

export type PartnerContext = {
  session: SessionUser
  partnerProfile: PartnerProfileLink
  partner: Partner
}

export async function requirePartnerContext(): Promise<PartnerContext> {
  const session = await requireAuth()

  if (!session.roles.includes("PARTNER")) {
    redirect(resolveHomeForRoles(session.roles, session.primaryRole))
  }

  const partnerProfile = await findPartnerProfileByUserId(session.id)
  if (!partnerProfile) {
    redirect("/onboarding/partner")
  }

  const owned = await findOwnedPartnerForUser(session.id)
  if (!owned || owned.partnerProfile.linkedPartnerId !== owned.partner.id) {
    redirect("/partner/pending")
  }

  return {
    session,
    partnerProfile: owned.partnerProfile,
    partner: owned.partner,
  }
}
