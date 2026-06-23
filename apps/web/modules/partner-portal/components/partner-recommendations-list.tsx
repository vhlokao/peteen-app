import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildProfessionalDiscoverUrl } from "@/modules/partner-portal/domain/navigation"
import type { PartnerRecommendationGroup } from "../domain/types"

export function PartnerRecommendationsList({
  groups,
}: {
  groups: PartnerRecommendationGroup[]
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma recomendação registrada ainda.
          </p>
          <Link
            href="/onboarding/partner"
            className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}
          >
            Fazer primeira recomendação
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.professionalId}>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">{group.displayName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {group.city} · {group.specialty}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={group.isConnectionActive ? "default" : "secondary"}>
                  {group.isConnectionActive ? "Conexão ativa" : "Sem conexão ativa"}
                </Badge>
                <Link
                  href={buildProfessionalDiscoverUrl(
                    group.professionalId,
                    "/partner/recommendations"
                  )}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "gap-1",
                  })}
                >
                  Perfil público
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {group.recommendations.map((rec) => (
                <li
                  key={rec.connectionId}
                  className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm text-muted-foreground">
                    {format(rec.recommendedAt, "dd MMM yyyy", { locale: ptBR })}
                  </span>
                  <Badge variant={rec.isActive ? "outline" : "secondary"}>
                    {rec.statusLabel}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
