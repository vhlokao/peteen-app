import { Heart, Repeat2, Users } from "lucide-react"

import { formatRelationshipSummary } from "@/modules/relationship/domain/relationship-levels"
import {
  RELATIONSHIP_LEVEL_ICONS,
  RELATIONSHIP_LEVEL_LABELS,
} from "@/modules/relationship/domain/constants"
import type { RelationshipLevel } from "@/modules/relationship/domain/types"

const NAVY_SOFT = "#2C4893"
const CORAL = "#E07A5F"
const GREEN = "#40916C"

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
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: "#FBEDE8" }}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg"
            aria-hidden
          >
            {RELATIONSHIP_LEVEL_ICONS[myRelationship.relationshipLevel]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              {formatRelationshipSummary(displayName, myRelationship.completedServices)}
            </p>
            <p className="text-xs" style={{ color: CORAL }}>
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
          <div className="rounded-[15px] border border-border/70 bg-card p-3 text-center">
            <div className="text-[20px] font-extrabold leading-none" style={{ color: NAVY_SOFT }}>
              {analytics.totalRelationships}
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1 text-[10.5px] font-semibold leading-tight text-muted-foreground">
              <Users className="size-3" />
              tutores atendidos
            </div>
          </div>
          <div className="rounded-[15px] border border-border/70 bg-card p-3 text-center">
            <div className="text-[20px] font-extrabold leading-none" style={{ color: CORAL }}>
              {analytics.recurringClients}
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1 text-[10.5px] font-semibold leading-tight text-muted-foreground">
              <Repeat2 className="size-3" />
              voltaram 3+ vezes
            </div>
          </div>
          <div className="rounded-[15px] border border-border/70 bg-card p-3 text-center">
            <div className="text-[20px] font-extrabold leading-none" style={{ color: GREEN }}>
              {analytics.trustedClients}
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1 text-[10.5px] font-semibold leading-tight text-muted-foreground">
              <Heart className="size-3" />
              relações confiáveis
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
