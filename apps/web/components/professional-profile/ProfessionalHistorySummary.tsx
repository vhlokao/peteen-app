import { Heart, Repeat2, Users } from "lucide-react"

import { formatRelationshipSummary } from "@/modules/relationship/domain/relationship-levels"
import {
  RELATIONSHIP_LEVEL_ICONS,
  RELATIONSHIP_LEVEL_LABELS,
} from "@/modules/relationship/domain/constants"
import type { RelationshipLevel } from "@/modules/relationship/domain/types"

type MyRelationship = {
  completedServices: number
  relationshipLevel: RelationshipLevel
  lastServiceAt: Date | null
}

type Analytics = {
  totalRelationships: number
  recurringClients: number
  trustedClients: number
}

type ProfessionalHistorySummaryProps = {
  displayName: string
  myRelationship: MyRelationship | null
  analytics: Analytics | null
}

/**
 * Histórico/recorrência — só renderiza o que tem dado real.
 * "X tutores voltaram", "Você já contratou X vezes" — sinais humanos,
 * nenhum cálculo de confiança aqui.
 */
export function ProfessionalHistorySummary({
  displayName,
  myRelationship,
  analytics,
}: ProfessionalHistorySummaryProps) {
  const hasMyRelationship = myRelationship != null && myRelationship.completedServices > 0
  const hasAnalytics = analytics != null && analytics.totalRelationships > 0

  if (!hasMyRelationship && !hasAnalytics) return null

  return (
    <section className="mb-5 space-y-3">
      {hasMyRelationship && myRelationship && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-lg" aria-hidden>
            {RELATIONSHIP_LEVEL_ICONS[myRelationship.relationshipLevel]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {formatRelationshipSummary(displayName, myRelationship.completedServices)}
            </p>
            <p className="text-xs text-muted-foreground">
              {RELATIONSHIP_LEVEL_LABELS[myRelationship.relationshipLevel]}
              {myRelationship.lastServiceAt && (
                <>
                  {" "}
                  · último atendimento em{" "}
                  {new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(
                    new Date(myRelationship.lastServiceAt)
                  )}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {hasAnalytics && analytics && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3 text-center">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-base font-bold tabular-nums text-foreground">
              {analytics.totalRelationships}
            </span>
            <span className="text-[0.6rem] leading-tight text-muted-foreground">
              tutores atendidos
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3 text-center">
            <Repeat2 className="size-4 text-muted-foreground" />
            <span className="text-base font-bold tabular-nums text-foreground">
              {analytics.recurringClients}
            </span>
            <span className="text-[0.6rem] leading-tight text-muted-foreground">
              voltaram 3+ vezes
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3 text-center">
            <Heart className="size-4 text-muted-foreground" />
            <span className="text-base font-bold tabular-nums text-foreground">
              {analytics.trustedClients}
            </span>
            <span className="text-[0.6rem] leading-tight text-muted-foreground">
              relações confiáveis
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
