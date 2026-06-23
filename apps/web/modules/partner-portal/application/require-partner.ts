/**
 * Módulo: partner-portal
 * Camada: application — guard de acesso para rotas do parceiro
 */

import { notFound, redirect } from "next/navigation"

import { requireAuth } from "@/modules/identity/application/get-session"
import type { SessionUser } from "@/modules/identity/domain/types"
import type { Partner } from "@/modules/partners/domain/types"
import {
  findOwnedPartnerForUser,
  type PartnerProfileLink,
} from "../infrastructure/repository"

export type PartnerContext = {
  session: SessionUser
  partnerProfile: PartnerProfileLink
  partner: Partner
}

function redirectForNonPartner(session: SessionUser): never {
  if (session.roles.includes("PROFESSIONAL")) redirect("/professional")
  if (session.roles.includes("TUTOR")) redirect("/tutor")
  if (session.roles.includes("ADMIN")) redirect("/admin")
  redirect("/dashboard")
}

export async function requirePartnerContext(): Promise<PartnerContext> {
  const session = await requireAuth()

  if (!session.roles.includes("PARTNER")) {
    redirectForNonPartner(session)
  }

  const owned = await findOwnedPartnerForUser(session.id)
  if (!owned) {
    redirect("/onboarding/partner")
  }

  if (owned.partnerProfile.linkedPartnerId !== owned.partner.id) {
    notFound()
  }

  return {
    session,
    partnerProfile: owned.partnerProfile,
    partner: owned.partner,
  }
}
