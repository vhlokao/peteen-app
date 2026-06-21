import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { findProfessionalPetsAttended } from "@/modules/professional-crm/infrastructure/queries"
import { ProfessionalPetsList } from "@/modules/professional-crm/components/professional-pets-list"

export const metadata: Metadata = {
  title: "Pets atendidos",
}

export default async function ProfessionalPetsPage() {
  const { profile } = await requireProfessionalContext()
  const pets = await findProfessionalPetsAttended(profile.id)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Pets atendidos"
        description="Histórico de pets atendidos e contexto reputacional."
      />
      <ProfessionalPetsList pets={pets} />
    </div>
  )
}
