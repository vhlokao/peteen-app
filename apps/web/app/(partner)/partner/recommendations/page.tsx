import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { getPartnerRecommendationGroups } from "@/modules/partner-portal/infrastructure/queries"
import { PartnerRecommendationsList } from "@/modules/partner-portal/components/partner-recommendations-list"

export const metadata: Metadata = {
  title: "Recomendações — Parceiro",
}

export default async function PartnerRecommendationsPage() {
  const { partner } = await requirePartnerContext()
  const groups = await getPartnerRecommendationGroups(partner.id)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Recomendações"
        description="Profissionais que sua organização indicou na rede Peteen."
      />
      <PartnerRecommendationsList groups={groups} />
    </div>
  )
}
