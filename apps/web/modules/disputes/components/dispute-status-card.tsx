import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Scale } from "lucide-react"

import type { DisputeSummary } from "../domain/types"
import { formatDisputeStatusLabel } from "../domain/formatters"
import { DisputeStatusBadge } from "./dispute-status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  dispute: DisputeSummary
}

export function DisputeStatusCard({ dispute }: Props) {
  const isActive = dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW"

  return (
    <Card className="border-amber-200 dark:border-amber-800/40">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-amber-600" />
            Problema reportado
          </CardTitle>
          <DisputeStatusBadge status={dispute.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Você já reportou um problema neste atendimento.{" "}
          <span className="font-medium text-foreground">
            Status atual: {formatDisputeStatusLabel(dispute.status)}.
          </span>
        </p>
        <p className="text-muted-foreground">
          {isActive
            ? "A equipe Peteen pode analisar o caso. O histórico fica registrado nesta solicitação."
            : "O registro permanece no histórico desta solicitação para consulta."}
        </p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Motivo</dt>
            <dd className="font-medium">{dispute.reason}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Reportado em</dt>
            <dd>{format(dispute.createdAt, "dd MMM yyyy", { locale: ptBR })}</dd>
          </div>
        </dl>
        {dispute.description ? (
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground">
            {dispute.description}
          </p>
        ) : null}
        {dispute.resolvedAt ? (
          <p className="text-xs text-muted-foreground">
            Atualizado em{" "}
            {format(dispute.resolvedAt, "dd MMM yyyy", { locale: ptBR })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
