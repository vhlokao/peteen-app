import type { Metadata } from "next"
import Link from "next/link"

import { PartnerOnboardingWizard } from "@/modules/partners/components/PartnerOnboardingWizard"

export const metadata: Metadata = {
  title: "Entrar na rede — Parceiro Peteen",
  description: "Ajude seus clientes indicando profissionais confiáveis.",
}

export default function PartnerOnboardingPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-block text-xs text-muted-foreground hover:text-foreground"
      >
        ← Voltar ao início
      </Link>
      <PartnerOnboardingWizard />
    </div>
  )
}
