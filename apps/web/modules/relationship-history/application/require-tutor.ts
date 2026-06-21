/**
 * Módulo: relationship-history
 * Camada: application — guard de acesso para rotas do tutor
 */

import { redirect } from "next/navigation"

import { requireAuth } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import type { TutorProfileData } from "@/modules/tutor/domain/types"
import type { SessionUser } from "@/modules/identity/domain/types"

export type TutorContext = {
  session: SessionUser
  profile: TutorProfileData
}

export async function requireTutorContext(): Promise<TutorContext> {
  const session = await requireAuth()

  if (!session.roles.includes("TUTOR")) {
    redirect("/professional")
  }

  const profile = await findTutorProfileByUserId(session.id)
  if (!profile) {
    redirect("/onboarding/tutor")
  }

  return { session, profile }
}
