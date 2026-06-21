import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, Repeat, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  RELATIONSHIP_LEVEL_ICONS,
} from "@/modules/relationship/domain/constants"
import type { RelationshipLevel } from "@/modules/relationship/domain/types"
import type { RelationshipSummary } from "../domain/types"

type RelationshipSummaryCardProps = {
  summary: RelationshipSummary
  /** Rótulo do par (tutor ou profissional) — exibido no topo quando fornecido */
  subjectLabel?: string
  subjectName?: string
  subjectDetail?: string
  /** Badge extra para visão profissional */
  showRecurringBadge?: boolean
}

export function RelationshipSummaryCard({
  summary,
  subjectLabel,
  subjectName,
  subjectDetail,
  showRecurringBadge = true,
}: RelationshipSummaryCardProps) {
  const fmt = (d: Date | null) =>
    d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—"

  const level = summary.relationshipLevel as RelationshipLevel
  const levelIcon = RELATIONSHIP_LEVEL_ICONS[level] ?? ""

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {subjectLabel && (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {subjectLabel}
              </p>
            )}
            {subjectName && (
              <CardTitle className="mt-1 flex items-center gap-2 text-xl">
                <Users className="size-5 text-muted-foreground" />
                {subjectName}
              </CardTitle>
            )}
            {subjectDetail && (
              <p className="mt-1 text-sm text-muted-foreground">{subjectDetail}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {levelIcon} {summary.relationshipLevelLabel}
            </Badge>
            {showRecurringBadge && summary.isRecurring && (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <Repeat className="size-3" />
                Cliente recorrente
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Atendimentos concluídos
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.completedServices}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total de solicitações
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.totalRequests}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-3" />
              Último atendimento
            </p>
            <p className="mt-1 text-sm font-medium">{fmt(summary.lastServiceAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
