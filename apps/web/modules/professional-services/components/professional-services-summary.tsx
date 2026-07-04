import { CheckCircle2, PauseCircle, Package } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { ProfessionalServiceRow } from "../domain/types"

/**
 * No máximo 3 indicadores reais — nada de dashboard.
 */
export function ProfessionalServicesSummary({ services }: { services: ProfessionalServiceRow[] }) {
  const active = services.filter((s) => s.isActive).length
  const paused = services.length - active

  const cards: { value: number; label: string; icon: LucideIcon }[] = [
    { value: services.length, label: "Total", icon: Package },
    { value: active, label: "Ativos", icon: CheckCircle2 },
    { value: paused, label: "Pausados", icon: PauseCircle },
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
