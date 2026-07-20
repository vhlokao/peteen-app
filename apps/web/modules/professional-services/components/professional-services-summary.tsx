import { CheckCircle2 } from "lucide-react"

import type { ProfessionalServiceRow } from "../domain/types"

const GREEN = "#40916C"

/**
 * Resumo leve — um indicador real (ativos), sem card pesado/dashboard.
 */
export function ProfessionalServicesSummary({ services }: { services: ProfessionalServiceRow[] }) {
  const active = services.filter((s) => s.isActive).length

  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4 shrink-0" style={{ color: GREEN }} />
      {active === 1 ? "1 serviço ativo" : `${active} serviços ativos`}
      <span className="text-muted-foreground/60">· aparecem nas buscas</span>
    </p>
  )
}
