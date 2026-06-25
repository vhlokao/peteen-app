import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { getPartnerRecommendations } from "@/modules/partner-portal/infrastructure/queries"
import { PartnerRecommendationsList } from "@/modules/partner-portal/components/partner-recommendations-list"

export const metadata: Metadata = {
  title: "Recomendações — Parceiro",
}

export default async function PartnerRecommendationsPage() {
  const { partner } = await requirePartnerContext()
  const recommendations = await getPartnerRecommendations(partner.id)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Recomendações"
        description="Gerencie os profissionais que sua organização indica na rede Peteen."
      />
      <PartnerRecommendationsList
        recommendations={recommendations}
        defaultCity={partner.city}
      />
    </div>
  )
}
