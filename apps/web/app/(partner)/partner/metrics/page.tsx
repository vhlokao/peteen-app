import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { getPartnerMetricsData } from "@/modules/partner-portal/infrastructure/queries"
import { PartnerMetricsGrid } from "@/modules/partner-portal/components/partner-metrics-grid"

export const metadata: Metadata = {
  title: "Métricas — Parceiro",
}

export default async function PartnerMetricsPage() {
  const { partner } = await requirePartnerContext()
  const metrics = await getPartnerMetricsData(partner.id, partner)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Métricas"
        description="Indicadores da sua participação na rede — dados existentes, sem scores novos."
      />
      <PartnerMetricsGrid metrics={metrics} />
    </div>
  )
}
