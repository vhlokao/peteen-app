import type { Metadata } from "next"

import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { getPartnerRecommendations } from "@/modules/partner-portal/infrastructure/queries"
import { PartnerRecommendationsList } from "@/modules/partner-portal/components/partner-recommendations-list"

export const metadata: Metadata = {
  title: "Suas recomendações",
}

export default async function PartnerRecommendationsPage() {
  const { partner } = await requirePartnerContext()
  const recommendations = await getPartnerRecommendations(partner.id)

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Suas recomendações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indique profissionais que você conhece e confia.
        </p>
      </header>
      <PartnerRecommendationsList recommendations={recommendations} defaultCity={partner.city} />
    </div>
  )
}
