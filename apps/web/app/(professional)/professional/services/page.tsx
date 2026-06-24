import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { getProfessionalServices } from "@/modules/professional-services/infrastructure/queries"
import { ProfessionalServicesList } from "@/modules/professional-services/components/professional-services-list"

export const metadata: Metadata = {
  title: "Meus Serviços",
}

export default async function ProfessionalServicesPage() {
  const { profile } = await requireProfessionalContext()
  const services = await getProfessionalServices(profile.id)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Meus Serviços"
        description="Gerencie os serviços que tutores podem solicitar no Discovery."
      />
      <ProfessionalServicesList services={services} />
    </div>
  )
}
