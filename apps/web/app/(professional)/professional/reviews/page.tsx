import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { getProfessionalReviewsData } from "@/modules/professional-crm/infrastructure/queries"
import { ProfessionalReviewsPanel } from "@/modules/professional-crm/components/professional-reviews-panel"

export const metadata: Metadata = {
  title: "Avaliações",
}

export default async function ProfessionalReviewsPage() {
  const { profile } = await requireProfessionalContext()
  const reviews = await getProfessionalReviewsData(profile.id)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Avaliações"
        description="Avaliações recebidas dos tutores — somente leitura."
      />
      <ProfessionalReviewsPanel data={reviews} />
    </div>
  )
}
