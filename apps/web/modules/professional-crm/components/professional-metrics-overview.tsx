import { CheckCircle2, Repeat2, Star, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type ProfessionalMetricsOverviewProps = {
  completedServices: number
  recurringClients: number
  averageRating: number | null
  uniqueClients: number
}

type MetricCard = {
  value: string
  label: string
  context: string
  icon: LucideIcon
}

/**
 * No máximo 4 indicadores reais, cada um com contexto humano — sem
 * benchmark, sem meta artificial.
 */
export function ProfessionalMetricsOverview({
  completedServices,
  recurringClients,
  averageRating,
  uniqueClients,
}: ProfessionalMetricsOverviewProps) {
  const cards: MetricCard[] = [
    {
      value: String(completedServices),
      label: "Concluídos",
      context: "Atendimentos finalizados",
      icon: CheckCircle2,
    },
    {
      value: String(recurringClients),
      label: "Recorrentes",
      context: recurringClients === 1 ? "Cliente voltou a contratar" : "Clientes voltaram a contratar",
      icon: Repeat2,
    },
    {
      value: averageRating !== null ? averageRating.toFixed(1) : "—",
      label: "Avaliação média",
      context: averageRating !== null ? "Nota média dos tutores" : "Ainda sem avaliações",
      icon: Star,
    },
    {
      value: String(uniqueClients),
      label: "Tutores atendidos",
      context: "Clientes únicos",
      icon: Users,
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
