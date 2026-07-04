import Link from "next/link"
import { PawPrint, Repeat2, Users } from "lucide-react"

type ProfessionalClientsSummaryProps = {
  uniqueClients: number
  recurringClients: number
  petsAttended: number
}

/**
 * Resumo humano de clientes/recorrência — só números diretos, sem
 * expor peso de recorrência, fórmula ou ranking técnico.
 */
export function ProfessionalClientsSummary({
  uniqueClients,
  recurringClients,
  petsAttended,
}: ProfessionalClientsSummaryProps) {
  if (uniqueClients === 0) return null

  return (
    <Link
      href="/professional/clients"
      className="block rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Clientes e recorrência
      </p>
      <div className="flex flex-col gap-2.5 text-sm text-foreground">
        <p className="flex items-center gap-2">
          <Users className="size-4 shrink-0 text-primary" />
          {uniqueClients === 1
            ? "1 tutor já contratou você"
            : `${uniqueClients} tutores já contrataram você`}
        </p>
        {recurringClients > 0 && (
          <p className="flex items-center gap-2">
            <Repeat2 className="size-4 shrink-0 text-primary" />
            {recurringClients === 1
              ? "1 tutor voltou a contratar você"
              : `${recurringClients} tutores voltaram a contratar você`}
          </p>
        )}
        {petsAttended > 0 && (
          <p className="flex items-center gap-2">
            <PawPrint className="size-4 shrink-0 text-primary" />
            {petsAttended === 1 ? "1 pet já foi atendido" : `${petsAttended} pets já foram atendidos`}
          </p>
        )}
      </div>
    </Link>
  )
}
