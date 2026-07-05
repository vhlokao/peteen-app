"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CitySearchInputProps = {
  defaultValue?: string
  defaultNeighborhood?: string
}

/**
 * Busca por cidade + bairro opcional (Location Foundation V0).
 * A URL continua sendo a única fonte de verdade dos filtros: cidade em
 * `city`, bairro em `neighborhood` (removido quando vazio).
 */
export function CitySearchInput({
  defaultValue = "",
  defaultNeighborhood = "",
}: CitySearchInputProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [city, setCity] = useState(defaultValue)
  const [neighborhood, setNeighborhood] = useState(defaultNeighborhood)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = city.trim()
    if (!trimmed) return
    const trimmedNeighborhood = neighborhood.trim()

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("city", trimmed)
      if (trimmedNeighborhood.length >= 2) {
        params.set("neighborhood", trimmedNeighborhood)
      } else {
        params.delete("neighborhood")
      }
      params.delete("offset")
      router.push(`/discover?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Digite sua cidade…"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="pl-9"
          aria-label="Cidade"
        />
      </div>
      <Input
        type="text"
        placeholder="Bairro (opcional)"
        value={neighborhood}
        onChange={(e) => setNeighborhood(e.target.value)}
        className="sm:max-w-[180px]"
        aria-label="Bairro (opcional)"
      />
      <Button type="submit" size="sm" disabled={isPending} className="sm:self-stretch">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
      </Button>
    </form>
  )
}
