"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createPartnerRecommendationAction } from "../application/recommendation-actions"
import type { ProfessionalSearchResult } from "../domain/types"
import { PartnerRecommendationSearch } from "./partner-recommendation-search"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  defaultCity?: string
  onCancel: () => void
  onSuccess: () => void
}

export function PartnerRecommendationForm({
  defaultCity,
  onCancel,
  onSuccess,
}: Props) {
  const [selected, setSelected] = useState<ProfessionalSearchResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!selected) return

    startTransition(async () => {
      const result = await createPartnerRecommendationAction(selected.id)

      if (!result.success) {
        toast.error(result.error ?? "Erro ao adicionar recomendação.")
        return
      }

      toast.success("Recomendação adicionada com sucesso.")
      onSuccess()
    })
  }

  return (
    <div className="space-y-4">
      <PartnerRecommendationSearch
        defaultCity={defaultCity}
        onSelect={setSelected}
        onCancel={onCancel}
      />

      {selected && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Confirmar recomendação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Você está recomendando{" "}
              <span className="font-medium text-foreground">{selected.displayName}</span>
              {" "}({selected.city} · {selected.specialty})
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                disabled={isPending}
                className="gap-1.5"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Salvar recomendação
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelected(null)}
                disabled={isPending}
              >
                Escolher outro
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
