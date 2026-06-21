import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { findProfessionalClients } from "@/modules/professional-crm/infrastructure/queries"
import { ProfessionalClientsList } from "@/modules/professional-crm/components/professional-clients-list"

export const metadata: Metadata = {
  title: "Clientes",
}

export default async function ProfessionalClientsPage() {
  const { profile } = await requireProfessionalContext()
  const clients = await findProfessionalClients(profile.id)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Clientes"
        description="Tutores atendidos — recorrência, pets e histórico de contratações."
      />
      <ProfessionalClientsList clients={clients} />
    </div>
  )
}
