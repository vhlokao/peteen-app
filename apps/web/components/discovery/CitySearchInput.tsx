"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CitySearchInputProps = {
  defaultValue?: string
}

export function CitySearchInput({ defaultValue = "" }: CitySearchInputProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [city, setCity] = useState(defaultValue)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = city.trim()
    if (!trimmed) return

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("city", trimmed)
      params.delete("offset")
      router.push(`/discover?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
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
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
      </Button>
    </form>
  )
}
