import { Link2, ShieldCheck, ThumbsUp, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { PartnerMetricsData } from "../domain/types"

type MetricCard = {
  value: number
  label: string
  context: string
  icon: LucideIcon
}

/**
 * No máximo 4 indicadores reais — sem comissão, sem ranking, sem
 * benchmark.
 */
export function PartnerMetricsOverview({ metrics }: { metrics: PartnerMetricsData }) {
  const cards: MetricCard[] = [
    {
      value: metrics.totalRecommendations,
      label: "Recomendações",
      context: "Profissionais indicados",
      icon: Users,
    },
    {
      value: metrics.activeRecommendations,
      label: "Ativas",
      context: "Recomendações em vigor",
      icon: ThumbsUp,
    },
    {
      value: metrics.verifiedRecommended,
      label: "Verificados",
      context: "Profissionais verificados",
      icon: ShieldCheck,
    },
    {
      value: metrics.activeConnections,
      label: "Conexões",
      context: "Conexões ativas geradas",
      icon: Link2,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-[var(--shadow-card)]"
        >
          <card.icon className="size-4 text-primary" />
          <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{card.value}</p>
          <p className="text-xs font-medium text-foreground/80">{card.label}</p>
          <p className="mt-0.5 text-[0.65rem] leading-tight text-muted-foreground">{card.context}</p>
        </div>
      ))}
    </div>
  )
}
