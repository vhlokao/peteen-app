"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createPartnerRecommendationAction } from "../application/recommendation-actions"
import type { ProfessionalSearchResult } from "../domain/types"
import { PartnerRecommendationSearch } from "./partner-recommendation-search"
import { Button } from "@/components/ui/button"

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
    <div className="space-y-4 rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-primary/10">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Quem você está recomendando
      </h2>
      <PartnerRecommendationSearch
        defaultCity={defaultCity}
        onSelect={setSelected}
        onCancel={onCancel}
      />

      {selected && (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
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
        </div>
      )}
    </div>
  )
}
