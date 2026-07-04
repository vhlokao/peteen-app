import Link from "next/link"
import { Repeat2 } from "lucide-react"

type ProfessionalRecurrenceCardProps = {
  recurringClients: number
  completedServices: number
}

/**
 * Recorrência em linguagem humana — sem peso reputacional, sem fórmula.
 */
export function ProfessionalRecurrenceCard({
  recurringClients,
  completedServices,
}: ProfessionalRecurrenceCardProps) {
  if (recurringClients === 0) return null

  return (
    <Link
      href="/professional/clients"
      className="block rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Repeat2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recorrência
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {recurringClients === 1
              ? "1 tutor voltou a contratar você."
              : `${recurringClients} tutores voltaram a contratar você.`}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {completedServices === 1
          ? "1 atendimento concluído no total."
          : `${completedServices} atendimentos concluídos no total.`}
      </p>
    </Link>
  )
}
