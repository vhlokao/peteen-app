/**
 * Módulo: professional-crm
 * Camada: application — guard de acesso para rotas do profissional
 */

import { redirect } from "next/navigation"

import { requireAuth } from "@/modules/identity/application/get-session"
import { findProfessionalProfileByUserId } from "@/modules/professional/infrastructure/repository"
import type { ProfessionalProfileData } from "@/modules/professional/domain/types"
import type { SessionUser } from "@/modules/identity/domain/types"

export type ProfessionalContext = {
  session: SessionUser
  profile: ProfessionalProfileData
}

export async function requireProfessionalContext(): Promise<ProfessionalContext> {
  const session = await requireAuth()

  if (!session.roles.includes("PROFESSIONAL")) {
    redirect("/tutor")
  }

  const profile = await findProfessionalProfileByUserId(session.id)
  if (!profile) {
    redirect("/onboarding/professional")
  }

  return { session, profile }
}
