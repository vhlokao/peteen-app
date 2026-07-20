import Link from "next/link"
import { CheckCircle2, Repeat2, Users } from "lucide-react"

const CORAL = "#E07A5F"
const NAVY = "#1D2F6F"
const GREEN = "#40916C"

type ProfessionalClientsSummaryProps = {
  uniqueClients: number
  recurringClients: number
  completedServices: number
}

/**
 * "Reputação humana" — três números reais (sem expor peso de recorrência,
 * fórmula ou ranking técnico), coral/navy/green como no restante do reskin.
 */
export function ProfessionalClientsSummary({
  uniqueClients,
  recurringClients,
  completedServices,
}: ProfessionalClientsSummaryProps) {
  if (uniqueClients === 0) return null

  return (
    <Link
      href="/professional/clients"
      className="block rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Reputação humana
      </p>
      <div className="flex flex-col gap-2.5 text-sm text-foreground">
        <p className="flex items-center gap-2">
          <Repeat2 className="size-4 shrink-0" style={{ color: CORAL }} />
          {recurringClients === 1
            ? "1 tutor voltou a contratar você"
            : `${recurringClients} tutores voltaram a contratar você`}
        </p>
        <p className="flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" style={{ color: NAVY }} />
          {completedServices === 1
            ? "1 atendimento concluído"
            : `${completedServices} atendimentos concluídos`}
        </p>
        <p className="flex items-center gap-2">
          <Users className="size-4 shrink-0" style={{ color: GREEN }} />
          {uniqueClients === 1 ? "1 cliente único" : `${uniqueClients} clientes únicos`}
        </p>
      </div>
    </Link>
  )
}
