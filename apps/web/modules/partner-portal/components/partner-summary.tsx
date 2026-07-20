import { ShieldCheck, ThumbsUp, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { PartnerDashboardStats } from "../domain/types"

const NAVY = "#1D2F6F"
const GREEN = "#40916C"
const CORAL = "#E07A5F"

type MetricCard = {
  value: number
  label: string
  icon: LucideIcon
  color: string
}

/**
 * No máximo 3 indicadores reais — sem métrica nova.
 */
export function PartnerSummary({ stats }: { stats: PartnerDashboardStats }) {
  const cards: MetricCard[] = [
    { value: stats.activeRecommendations, label: "profissionais recomendados", icon: ThumbsUp, color: NAVY },
    { value: stats.verifiedRecommended, label: "recomendações verificadas", icon: ShieldCheck, color: GREEN },
    { value: stats.recommendedProfessionals, label: "total indicado", icon: Users, color: CORAL },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-[var(--shadow-card)]"
        >
          <card.icon className="size-4" style={{ color: card.color }} />
          <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{card.value}</p>
          <p className="text-[0.7rem] leading-tight text-muted-foreground">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
