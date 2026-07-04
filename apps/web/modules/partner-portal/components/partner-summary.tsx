import { ShieldCheck, ThumbsUp, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { PartnerDashboardStats } from "../domain/types"

type MetricCard = {
  value: number
  label: string
  icon: LucideIcon
}

/**
 * No máximo 3 indicadores reais — sem métrica nova.
 */
export function PartnerSummary({ stats }: { stats: PartnerDashboardStats }) {
  const cards: MetricCard[] = [
    { value: stats.recommendedProfessionals, label: "Recomendados", icon: Users },
    { value: stats.activeRecommendations, label: "Ativas", icon: ThumbsUp },
    { value: stats.verifiedRecommended, label: "Verificados", icon: ShieldCheck },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-[var(--shadow-card)]"
        >
          <card.icon className="size-4 text-primary" />
          <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{card.value}</p>
          <p className="text-[0.7rem] leading-tight text-muted-foreground">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
