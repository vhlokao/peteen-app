import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { ProfessionalRequestCard } from "./professional-request-card"

type ProfessionalAgendaGroupProps = {
  label: string
  requests: ServiceRequestWithParticipants[]
}

/**
 * Grupo de agenda por data real (Hoje/Amanhã/Próximos dias/Depois) —
 * reaproveita o mesmo card já usado em /requests (ProfessionalRequestCard),
 * evitando duplicar a lógica de status/pill/próximo passo.
 */
export function ProfessionalAgendaGroup({ label, requests }: ProfessionalAgendaGroupProps) {
  if (requests.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {requests.map((request) => (
          <ProfessionalRequestCard key={request.id} request={request} />
        ))}
      </div>
    </section>
  )
}
