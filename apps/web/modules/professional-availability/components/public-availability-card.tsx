import { CalendarClock } from "lucide-react"

import { formatPublicAvailabilityLine } from "../domain/formatters"
import type { PublicAvailabilityDay } from "../domain/types"

type Props = {
  days: PublicAvailabilityDay[]
}

export function PublicAvailabilityCard({ days }: Props) {
  const hasAvailability = days.length > 0

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Disponibilidade
        </h2>
      </div>

      {hasAvailability ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Costuma atender:</p>
          <ul className="space-y-1 text-sm text-foreground">
            {days.map((day) => (
              <li key={day.weekday}>{formatPublicAvailabilityLine(day)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Disponibilidade a combinar.</p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        A disponibilidade é indicativa e será confirmada pelo profissional após a
        solicitação.
      </p>
    </section>
  )
}
