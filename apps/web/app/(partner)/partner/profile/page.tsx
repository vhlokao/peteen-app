import type { Metadata } from "next"

import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { toPartnerPortalProfile } from "@/modules/partner-portal/infrastructure/repository"
import { PartnerProfileEditForm } from "@/modules/partner-portal/components/partner-profile-edit-form"
import { PartnerProfilePreview } from "@/modules/partner-portal/components/partner-profile-preview"

export const metadata: Metadata = {
  title: "Perfil do parceiro",
}

export default async function PartnerProfilePage() {
  const { partner } = await requirePartnerContext()
  const profile = toPartnerPortalProfile(partner)

  return (
    <div className="page-container max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Perfil do parceiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuide das informações que apresentam você à rede Peteen.
        </p>
      </header>

      <PartnerProfilePreview partner={profile} />

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Dados da organização
        </h2>
        <PartnerProfileEditForm partner={profile} />
      </section>
    </div>
  )
}
