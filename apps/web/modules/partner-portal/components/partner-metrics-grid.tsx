import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { PARTNER_VERIFICATION_STATUS_LABELS } from "@/modules/partners/domain/constants"
import type { PartnerMetricsData } from "../domain/types"

type MetricRow = {
  label: string
  value: string
}

export function PartnerMetricsGrid({ metrics }: { metrics: PartnerMetricsData }) {
  const rows: MetricRow[] = [
    { label: "Total de recomendações", value: String(metrics.totalRecommendations) },
    { label: "Recomendações ativas", value: String(metrics.activeRecommendations) },
    {
      label: "Profissionais verificados indicados",
      value: String(metrics.verifiedRecommended),
    },
    {
      label: "Profissionais recorrentes",
      value: String(metrics.recurringRecommended),
    },
    { label: "Conexões ativas", value: String(metrics.activeConnections) },
    {
      label: "Status da verificação",
      value: PARTNER_VERIFICATION_STATUS_LABELS[metrics.verificationStatus],
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <Card key={row.label}>
          <CardHeader className="pb-2">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {row.value}
            </p>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {row.label}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
