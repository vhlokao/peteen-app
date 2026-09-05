import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AccountSettingsPage } from "@/components/account/account-settings-page"
import { requireAuthOrRedirect } from "@/modules/identity/application/get-session"
import { resolveAccountBackHref } from "@/modules/identity/domain/account-navigation"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"

export const metadata: Metadata = {
  title: "Minha conta",
}

type PageProps = {
  /**
   * `returnTo` é carimbado pelo menu de conta com a rota de onde ele foi
   * aberto — Conta pode ser alcançada de qualquer tela. Validado no domínio
   * (área da persona + redirect aberto); ausente ou inválido cai em `/tutor`.
   */
  searchParams: Promise<{ returnTo?: string | string[] }>
}

export default async function TutorContaPage({ searchParams }: PageProps) {
  const { returnTo } = await searchParams
  const session = await requireAuthOrRedirect()
  const profile = await findTutorProfileByUserId(session.id)

  if (!profile) {
    redirect("/onboarding/tutor")
  }

  return (
    <AccountSettingsPage
      persona="tutor"
      backHref={resolveAccountBackHref("tutor", returnTo)}
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
