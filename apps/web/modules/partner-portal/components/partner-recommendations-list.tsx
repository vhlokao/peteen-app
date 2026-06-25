"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Plus } from "lucide-react"

import type { PartnerRecommendationRow } from "../domain/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Nenhum profissional recomendado
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Comece indicando profissionais confiáveis para fortalecer sua rede.
            </p>
          </div>
          <Button type="button" onClick={() => setCreating(true)}>
            Adicionar recomendação
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {recommendations.length} recomendação
          {recommendations.length !== 1 ? "ões" : ""}
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
            Nova recomendação
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

      <div className="space-y-3">
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
