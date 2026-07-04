"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Plus, Users } from "lucide-react"

import type { PartnerRecommendationRow } from "../domain/types"
import { Button } from "@/components/ui/button"
import { PartnerRecommendationCard } from "./partner-recommendation-card"
import { PartnerRecommendationForm } from "./partner-recommendation-form"

type Props = {
  recommendations: PartnerRecommendationRow[]
  defaultCity?: string
}

export function PartnerRecommendationsList({
  recommendations,
  defaultCity,
}: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  function refresh() {
    router.refresh()
  }

  if (recommendations.length === 0 && !creating) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card p-10 text-center shadow-[var(--shadow-card)]">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-7" />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Você ainda não recomendou nenhum profissional.
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Comece indicando profissionais confiáveis para fortalecer sua rede.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          Fazer primeira recomendação
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {recommendations.length} {recommendations.length !== 1 ? "recomendações" : "recomendação"}
          {" · "}
          {recommendations.filter((r) => r.isActive).length} ativa
          {recommendations.filter((r) => r.isActive).length !== 1 ? "s" : ""}
        </p>
        {!creating && (
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" />
            Recomendar profissional
          </Button>
        )}
      </div>

      {creating && (
        <PartnerRecommendationForm
          defaultCity={defaultCity}
          onCancel={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false)
            refresh()
          }}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {recommendations.map((recommendation) => (
          <PartnerRecommendationCard
            key={recommendation.connectionId}
            recommendation={recommendation}
            onUpdated={refresh}
          />
        ))}
      </div>
    </div>
  )
}
