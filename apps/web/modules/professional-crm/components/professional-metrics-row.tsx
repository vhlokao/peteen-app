import { CheckCircle2, Inbox, Star } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type ProfessionalMetricsRowProps = {
  activeRequests: number
  averageRating: number | null
  completedServices: number
}

type MetricCard = {
  value: string
  label: string
  context: string
  icon: LucideIcon
}

/**
 * No máximo 3 indicadores, cada um com número + label curto + contexto
 * humano — sem gráfico, sem grid denso de KPIs.
 */
export function ProfessionalMetricsRow({
  activeRequests,
  averageRating,
  completedServices,
}: ProfessionalMetricsRowProps) {
  const cards: MetricCard[] = [
    {
      value: String(activeRequests),
      label: "Ativas",
      context: "Solicitações em andamento",
      icon: Inbox,
    },
    {
      value: averageRating !== null ? averageRating.toFixed(1) : "—",
      label: "Avaliação média",
      context: averageRating !== null ? "Nota média dos tutores" : "Ainda sem avaliações",
      icon: Star,
    },
    {
      value: String(completedServices),
      label: "Concluídos",
      context: "Atendimentos finalizados",
      icon: CheckCircle2,
    },
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
          <p className="text-xs font-medium text-foreground/80">{card.label}</p>
          <p className="mt-0.5 text-[0.65rem] leading-tight text-muted-foreground">{card.context}</p>
        </div>
      ))}
    </div>
  )
}
