import type { Metadata } from "next"

import { AccountSettingsPage } from "@/components/account/account-settings-page"

export const metadata: Metadata = {
  title: "Conta",
}

export default function TutorContaPage() {
  return (
    <AccountSettingsPage
      profileHref="/tutor/perfil"
      profileLabel="Meu perfil"
      profileDescription="Dados de contato e localização"
    />
  )
}
