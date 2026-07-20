import type { Metadata } from "next"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { getProfessionalServices } from "@/modules/professional-services/infrastructure/queries"
import { ProfessionalServicesList } from "@/modules/professional-services/components/professional-services-list"

export const metadata: Metadata = {
  title: "Seus serviços",
}

export default async function ProfessionalServicesPage() {
  const { profile } = await requireProfessionalContext()
  const services = await getProfessionalServices(profile.id)

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Meus serviços</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize o que você oferece e como os tutores encontram seu trabalho.
        </p>
      </header>
      <ProfessionalServicesList services={services} />
    </div>
  )
}
