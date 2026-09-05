import type { Metadata } from "next"

import { AccountSettingsPage } from "@/components/account/account-settings-page"
import { resolveAccountBackHref } from "@/modules/identity/domain/account-navigation"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"

export const metadata: Metadata = {
  title: "Minha conta",
}

type PageProps = {
  /** Ver a nota equivalente na Conta do tutor. */
  searchParams: Promise<{ returnTo?: string | string[] }>
}

export default async function ProfessionalContaPage({ searchParams }: PageProps) {
  const { returnTo } = await searchParams
  const { session, profile } = await requireProfessionalContext()

  return (
    <AccountSettingsPage
      persona="professional"
      backHref={resolveAccountBackHref("professional", returnTo)}
      // Ver a nota equivalente na página do tutor sobre User vs Profile.
      displayName={profile.displayName}
      email={session.email}
      avatarUrl={profile.avatarUrl ?? null}
      roleLabel="Profissional"
      profileHref="/professional/profile"
      profileLabel="Perfil público"
      profileDescription="Foto, bio, serviços e presença pública"
    />
  )
}
