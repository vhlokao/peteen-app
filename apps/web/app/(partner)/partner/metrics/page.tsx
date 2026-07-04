import type { Metadata } from "next"

import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import {
  getPartnerMetricsData,
  findRecentPartnerActivity,
} from "@/modules/partner-portal/infrastructure/queries"
import { PartnerMetricsOverview } from "@/modules/partner-portal/components/partner-metrics-overview"
import { PartnerImpactCard } from "@/modules/partner-portal/components/partner-impact-card"
import { PartnerRecentActivity } from "@/modules/partner-portal/components/partner-recent-activity"
import { PartnerMetricsEmptyState } from "@/modules/partner-portal/components/partner-metrics-empty-state"

export const metadata: Metadata = {
  title: "Seu impacto — Parceiro",
}

/**
 * /partner/metrics — impacto real, sem dashboard técnico (UX 3.9).
 * Nenhum gráfico: não existe série histórica real no modelo.
 */
export default async function PartnerMetricsPage() {
  const { partner } = await requirePartnerContext()

  const [metrics, recentActivity] = await Promise.all([
    getPartnerMetricsData(partner.id, partner),
    findRecentPartnerActivity(partner.id, partner.slug, 5),
  ])

  const hasHistory = metrics.totalRecommendations > 0

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Seu impacto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja como suas recomendações fortalecem a rede Peteen.
        </p>
      </header>

      {!hasHistory ? (
        <PartnerMetricsEmptyState />
      ) : (
        <div className="flex flex-col gap-5">
          <PartnerMetricsOverview metrics={metrics} />

          <PartnerImpactCard
            activeRecommendations={metrics.activeRecommendations}
            verifiedRecommended={metrics.verifiedRecommended}
          />

          <PartnerRecentActivity items={recentActivity} />
        </div>
      )}
    </div>
  )
}
