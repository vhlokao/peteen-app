import { CheckCircle2, Inbox, Star } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type ProfessionalMetricsRowProps = {
  /**
   * `null` = a busca que alimenta esta métrica falhou; o card mostra "—" em
   * vez de um número parcial (CRITICAL FLOW PERFORMANCE — METRIC CONSISTENCY).
   * "Ativas" soma solicitações em andamento (stats) + pendentes (busca de
   * requests): se a segunda falha, o total ficaria SUBCONTADO e seria exibido
   * como se fosse definitivo. Zero é uma resposta legítima; "não sei" não é
   * zero. Mesma semântica que `averageRating` já usa aqui.
   */
  activeRequests: number | null
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
      value: activeRequests !== null ? String(activeRequests) : "—",
      label: "Ativas",
      context:
        activeRequests !== null
          ? "Solicitações em andamento"
          : "Não foi possível atualizar esta métrica.",
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
