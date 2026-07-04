import { Play } from "lucide-react"

import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { ProfessionalRequestCard } from "./professional-request-card"

/**
 * Destaque do atendimento em andamento — topo da agenda. Reaproveita o
 * mesmo ProfessionalRequestCard (CTA "Continuar" já leva ao detalhe real).
 */
export function ProfessionalAgendaInProgress({
  request,
}: {
  request: ServiceRequestWithParticipants
}) {
  return (
    <section className="rounded-2xl border border-teal-500/25 bg-teal-500/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-teal-700 dark:text-teal-400">
        <Play className="size-4 shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-widest">
          Atendimento em andamento
        </p>
      </div>
      <ProfessionalRequestCard request={request} />
    </section>
  )
}
