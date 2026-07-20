"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Search } from "lucide-react"

import { KNOWN_LOCATIONS } from "@/modules/location/domain/known-locations"

const NAVY_SOFT = "#2C4893"

type CitySearchInputProps = {
  defaultValue?: string
}

/**
 * Filtro de cidade (Location Foundation V0) — select com as cidades
 * conhecidas (KNOWN_LOCATIONS), consistente com o que os profissionais
 * cadastram no onboarding. A URL continua sendo a única fonte de verdade
 * do filtro: cidade em `city`. Um eventual `neighborhood` legado na URL é
 * removido na troca de cidade.
 */
export function CitySearchInput({
  defaultValue = "",
}: CitySearchInputProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const city = e.target.value

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (city) {
        params.set("city", city)
      } else {
        params.delete("city")
      }
      params.delete("neighborhood")
      params.delete("offset")
      router.push(`/discover?${params.toString()}`)
    })
  }

  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2"
        style={{ color: NAVY_SOFT }}
      />
      <select
        value={defaultValue}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Cidade"
        className="h-11 w-full rounded-[14px] border-[1.5px] border-input bg-background pl-10 pr-9 text-[14.5px] font-medium focus-visible:border-[#2C4893] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2C4893]/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Todas as cidades</option>
        {KNOWN_LOCATIONS.map((loc) => (
          <option key={loc.city} value={loc.city}>
            {loc.city} — {loc.state}
          </option>
        ))}
      </select>
      {isPending && (
        <Loader2
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin"
          style={{ color: NAVY_SOFT }}
        />
      )}
    </div>
  )
}
