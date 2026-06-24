import { Star, Repeat2, CheckCircle2, Users, ThumbsUp, ShieldCheck } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getProfessionalTrustSummary } from "../application/get-reputation"
import { ReputationBadgePill } from "./reputation-badge-pill"

type ProfessionalTrustSummaryProps = {
  professionalId: string
  viewerRelationshipCompletedServices?: number
  hideBadges?: boolean
}

export async function ProfessionalTrustSummary({
  professionalId,
  viewerRelationshipCompletedServices,
  hideBadges = false,
}: ProfessionalTrustSummaryProps) {
  const summary = await getProfessionalTrustSummary(professionalId, {
    viewerRelationshipCompletedServices,
  })

  if (!summary) return null

  const stats = [
    {
      label: "Índice de Confiança",
      value: summary.trustScore.toFixed(1),
      icon: Star,
      iconClass: "fill-amber-400 text-amber-400",
    },
    {
      label: "Total de Avaliações",
      value: String(summary.totalReviews),
      sub:
        summary.averageRating !== null
          ? `Média ${summary.averageRating.toFixed(1)}`
          : undefined,
      icon: ThumbsUp,
    },
    {
      label: "Clientes Recorrentes",
      value: String(summary.recurringClientsCount),
      icon: Repeat2,
    },
    {
      label: "Serviços Concluídos",
      value: String(summary.completedServices),
      icon: CheckCircle2,
    },
    {
      label: "Recomendações",
      value: String(summary.recommendationsCount),
      icon: Users,
    },
    {
      label: "Verificação",
      value: summary.verificationLabel,
      icon: ShieldCheck,
    },
  ] as const

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo reputacional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <stat.icon
                    className={`size-3.5 shrink-0 ${"iconClass" in stat ? stat.iconClass : ""}`}
                  />
                  <span>{stat.label}</span>
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {stat.value}
                </p>
                {"sub" in stat && stat.sub && (
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                )}
              </div>
            ))}
          </div>

          {!hideBadges && summary.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
              {summary.badges.map((badge) => (
                <ReputationBadgePill key={badge.type} badge={badge} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
