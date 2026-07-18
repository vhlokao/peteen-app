"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const NAVY = "#1D2F6F"
const NAVY_SOFT = "#2C4893"

type CitySearchInputProps = {
  defaultValue?: string
}

/**
 * Busca por cidade (Location Foundation V0).
 * A URL continua sendo a única fonte de verdade do filtro: cidade em `city`.
 * Um eventual `neighborhood` legado na URL é removido no submit.
 */
export function CitySearchInput({
  defaultValue = "",
}: CitySearchInputProps) {
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
      params.delete("neighborhood")
      params.delete("offset")
      router.push(`/discover?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2"
          style={{ color: NAVY_SOFT }}
        />
        <Input
          type="text"
          placeholder="Digite sua cidade…"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="h-11 rounded-[14px] border-[1.5px] pl-10 text-[14.5px] font-medium focus-visible:border-[#2C4893] focus-visible:ring-4 focus-visible:ring-[#2C4893]/10"
          aria-label="Cidade"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        className="h-11 rounded-[14px] px-5 font-bold sm:self-stretch"
        style={{ background: NAVY }}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
      </Button>
    </form>
  )
}
