import { PawPrint, Repeat2, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type ProfessionalClientsOverviewProps = {
  totalClients: number
  recurringClients: number
  petsAttended: number
}

/**
 * No máximo 3 indicadores reais — resumo humano, não dashboard denso.
 */
export function ProfessionalClientsOverview({
  totalClients,
  recurringClients,
  petsAttended,
}: ProfessionalClientsOverviewProps) {
  const cards: { value: number; label: string; icon: LucideIcon }[] = [
    { value: totalClients, label: "Tutores atendidos", icon: Users },
    { value: recurringClients, label: "Clientes recorrentes", icon: Repeat2 },
    { value: petsAttended, label: "Pets atendidos", icon: PawPrint },
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
