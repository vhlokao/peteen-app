import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RequestStatus } from "@/modules/service-request/domain/types"
import type { RelationshipRequestRow } from "../domain/types"

const STATUS_BADGE_STYLES: Partial<Record<RequestStatus, string>> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ACCEPTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS:
    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  COMPLETED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED_BY_TUTOR: "bg-muted text-muted-foreground",
  CANCELLED_BY_PROFESSIONAL:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  DISPUTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  EXPIRED: "bg-muted text-muted-foreground",
}

export function RelationshipRequestsList({
  requests,
}: {
  requests: RelationshipRequestRow[]
}) {
  const fmt = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de solicitações</CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma solicitação encontrada.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((req) => {
              const statusStyle =
                STATUS_BADGE_STYLES[req.status as RequestStatus] ??
                "bg-muted text-muted-foreground"

              return (
                <li key={req.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{req.serviceLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.petName ? `Pet: ${req.petName} · ` : ""}
                        {fmt(req.occurredAt)}
                      </p>
                    </div>
                    <Badge className={statusStyle} variant="secondary">
                      {req.statusLabel}
                    </Badge>
                  </div>
                  <Link
                    href={req.href}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Ver detalhe
                    <ArrowRight className="size-3" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
