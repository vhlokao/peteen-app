import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AccountSettingsPage } from "@/components/account/account-settings-page"
import { requireAuthOrRedirect } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"

export const metadata: Metadata = {
  title: "Minha conta",
}

export default async function TutorContaPage() {
  const session = await requireAuthOrRedirect()
  const profile = await findTutorProfileByUserId(session.id)

  if (!profile) {
    redirect("/onboarding/tutor")
  }

  return (
    <AccountSettingsPage
      persona="tutor"
      // `displayName` vem do TutorProfile (identidade da persona); `email` vem
      // do User (identidade da conta). São conceitos distintos e a tela os
      // mostra juntos de propósito — mas nunca os mistura como se fossem o
      // mesmo dado. Ver item 6 da missão.
      displayName={profile.displayName}
      email={session.email}
      avatarUrl={profile.avatarUrl ?? null}
      roleLabel="Tutor"
      profileHref="/tutor/perfil"
      profileLabel="Meu perfil"
      profileDescription="Nome, telefone e localização"
    />
  )
}
