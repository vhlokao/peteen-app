"use client"

import { useTransition } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ExternalLink, Power, PowerOff } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import {
  activatePartnerRecommendationAction,
  deactivatePartnerRecommendationAction,
} from "../application/recommendation-actions"
import type { PartnerRecommendationRow } from "../domain/types"
import { buildProfessionalDiscoverUrl } from "../domain/navigation"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  recommendation: PartnerRecommendationRow
  onUpdated: () => void
}

export function PartnerRecommendationCard({ recommendation, onUpdated }: Props) {
  const [isPending, startTransition] = useTransition()

  function toggleActive() {
    startTransition(async () => {
      const result = recommendation.isActive
        ? await deactivatePartnerRecommendationAction(recommendation.connectionId)
        : await activatePartnerRecommendationAction(recommendation.connectionId)

      if (!result.success) {
        toast.error(result.error ?? "Erro ao atualizar recomendação.")
        return
      }

      toast.success(
        recommendation.isActive
          ? "Recomendação desativada."
          : "Recomendação reativada."
      )
      onUpdated()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">{recommendation.displayName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {recommendation.city} · {recommendation.specialty}
            </p>
          </div>
          <Badge variant={recommendation.isActive ? "default" : "secondary"}>
            {recommendation.statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Recomendado em{" "}
          <span className="font-medium text-foreground">
            {format(recommendation.recommendedAt, "dd MMM yyyy", { locale: ptBR })}
          </span>
        </p>

        <div className="flex flex-wrap gap-2">
          <Link
            href={buildProfessionalDiscoverUrl(
              recommendation.professionalId,
              "/partner/recommendations"
            )}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "gap-1.5",
            })}
          >
            Perfil público
            <ExternalLink className="size-3.5" />
          </Link>
          <Button
            type="button"
            variant={recommendation.isActive ? "secondary" : "default"}
            size="sm"
            className="gap-1.5"
            onClick={toggleActive}
            disabled={isPending}
          >
            {recommendation.isActive ? (
              <>
                <PowerOff className="size-3.5" />
                Desativar recomendação
              </>
            ) : (
              <>
                <Power className="size-3.5" />
                Reativar recomendação
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
