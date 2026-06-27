import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlertTriangle } from "lucide-react"

import type { DisputeSummary } from "../domain/types"
import { DISPUTE_STATUS_LABELS } from "../domain/types"
import { Badge } from "@/components/ui/badge"

type Props = {
  dispute: DisputeSummary
}

export function DisputeBanner({ dispute }: Props) {
  const isActive = dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW"

  if (!isActive && dispute.status !== "RESOLVED" && dispute.status !== "REJECTED") {
    return null
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/40 dark:bg-amber-900/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {isActive
                ? "Existe uma disputa aberta para esta solicitação."
                : "Disputa encerrada nesta solicitação."}
            </h2>
            <Badge variant={isActive ? "destructive" : "secondary"}>
              {DISPUTE_STATUS_LABELS[dispute.status]}
            </Badge>
          </div>
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Motivo</dt>
              <dd className="font-medium text-foreground">{dispute.reason}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Aberta em</dt>
              <dd className="text-foreground">
                {format(dispute.createdAt, "dd MMM yyyy", { locale: ptBR })}
              </dd>
            </div>
          </dl>
          {dispute.description ? (
            <p className="text-sm text-muted-foreground">{dispute.description}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
