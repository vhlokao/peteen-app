"use client"

import { useState, useTransition } from "react"
import { Loader2, Search } from "lucide-react"

import { searchProfessionalsForRecommendationAction } from "../application/recommendation-actions"
import type { ProfessionalSearchResult } from "../domain/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  defaultCity?: string
  onSelect: (professional: ProfessionalSearchResult) => void
  onCancel: () => void
}

export function PartnerRecommendationSearch({
  defaultCity = "",
  onSelect,
  onCancel,
}: Props) {
  const [name, setName] = useState("")
  const [city, setCity] = useState(defaultCity)
  const [results, setResults] = useState<ProfessionalSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSearched(false)

    startTransition(async () => {
      const result = await searchProfessionalsForRecommendationAction(name, city)

      if (!result.success) {
        setError(result.error ?? "Erro ao buscar profissionais.")
        setResults([])
        return
      }

      setResults(result.data)
      setSearched(true)
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="search-name">Nome</Label>
            <Input
              id="search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Maria Silva"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="search-city">Cidade</Label>
            <Input
              id="search-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex.: São Paulo"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" className="gap-1.5" disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Buscar profissionais
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>

      {searched && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum profissional encontrado. Ajuste os filtros ou verifique se o profissional já foi recomendado.
        </p>
      )}

      {results.length > 0 && (
        <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
          {results.map((pro) => (
            <li key={pro.id}>
              <button
                type="button"
                onClick={() => onSelect(pro)}
                className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{pro.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {pro.city} · {pro.specialty} · Confiança {pro.trustScore.toFixed(0)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
