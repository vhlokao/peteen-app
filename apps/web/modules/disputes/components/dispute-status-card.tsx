import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Scale } from "lucide-react"

import type { DisputeSummary } from "../domain/types"
import { DISPUTE_STATUS_LABELS } from "../domain/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  dispute: DisputeSummary
}

export function DisputeStatusCard({ dispute }: Props) {
  return (
    <Card className="border-amber-200 dark:border-amber-800/40">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-amber-600" />
            Disputa registrada
          </CardTitle>
          <Badge variant={dispute.status === "RESOLVED" ? "secondary" : "default"}>
            {DISPUTE_STATUS_LABELS[dispute.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Sua solicitação foi enviada para análise. A equipe Peteen entrará em contato se
          necessário.
        </p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Motivo</dt>
            <dd className="font-medium">{dispute.reason}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Aberta em</dt>
            <dd>
              {format(dispute.createdAt, "dd MMM yyyy", { locale: ptBR })}
            </dd>
          </div>
        </dl>
        {dispute.description ? (
          <p className="text-muted-foreground">{dispute.description}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
