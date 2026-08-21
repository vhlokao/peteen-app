import type { Metadata } from "next"

import { AccountSettingsPage } from "@/components/account/account-settings-page"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"

export const metadata: Metadata = {
  title: "Minha conta",
}

export default async function ProfessionalContaPage() {
  const { session, profile } = await requireProfessionalContext()

  return (
    <AccountSettingsPage
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
