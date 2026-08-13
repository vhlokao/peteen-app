import type { Metadata } from "next"

import { AccountSettingsPage } from "@/components/account/account-settings-page"

export const metadata: Metadata = {
  title: "Conta",
}

export default function ProfessionalContaPage() {
  return (
    <AccountSettingsPage
      profileHref="/professional/profile"
      profileLabel="Perfil público"
      profileDescription="Dados profissionais e presença pública"
    />
  )
}
