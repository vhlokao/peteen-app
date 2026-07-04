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
import { buildDiscoverUrl } from "../domain/navigation"
import { PartnerStatusPill } from "./partner-status-pill"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"

type Props = {
  recommendation: PartnerRecommendationRow
  onUpdated: () => void
}

export function PartnerRecommendationCard({ recommendation, onUpdated }: Props) {
  const [isPending, startTransition] = useTransition()

  const initials = recommendation.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

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
        recommendation.isActive ? "Recomendação desativada." : "Recomendação reativada."
      )
      onUpdated()
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <Avatar className="size-11 shrink-0 rounded-xl">
          <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{recommendation.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {recommendation.city} · {recommendation.specialty}
          </p>
        </div>
        <PartnerStatusPill isActive={recommendation.isActive} size="sm" />
      </div>

      <p className="text-xs text-muted-foreground">
        Recomendado em{" "}
        <span className="font-medium text-foreground">
          {format(recommendation.recommendedAt, "dd MMM yyyy", { locale: ptBR })}
        </span>
      </p>

      <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
        <Link
          href={buildDiscoverUrl(recommendation.professionalId, {
            from: "partner",
            returnTo: "/partner/recommendations",
          })}
          className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
        >
          Perfil público
          <ExternalLink className="size-3.5" />
        </Link>
        <Button
          type="button"
          variant={recommendation.isActive ? "outline" : "default"}
          size="sm"
          className="gap-1.5"
          onClick={toggleActive}
          disabled={isPending}
        >
          {recommendation.isActive ? (
            <>
              <PowerOff className="size-3.5" />
              Desativar
            </>
          ) : (
            <>
              <Power className="size-3.5" />
              Reativar
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
