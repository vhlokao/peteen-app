"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createRegionAction,
  createNeighborhoodAction,
} from "@/modules/growth-engine/application/actions"

type RegionOption = { id: string; name: string; city: string; state: string }

type Props = {
  regions: RegionOption[]
}

export function CreateTerritoryForms({ regions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<"region" | "neighborhood">("region")

  const [regionCity, setRegionCity] = useState("")
  const [regionState, setRegionState] = useState("")
  const [regionName, setRegionName] = useState("")

  const [nbCity, setNbCity] = useState("")
  const [nbState, setNbState] = useState("")
  const [nbName, setNbName] = useState("")
  const [nbRegionId, setNbRegionId] = useState("")

  function handleCreateRegion(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createRegionAction({
        city: regionCity,
        state: regionState,
        name: regionName,
      })
      if (result.ok) {
        toast.success("Região criada")
        setRegionName("")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleCreateNeighborhood(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createNeighborhoodAction({
        city: nbCity,
        state: nbState,
        name: nbName,
        regionId: nbRegionId || undefined,
      })
      if (result.ok) {
        toast.success("Bairro criado")
        setNbName("")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("region")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            tab === "region"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Nova região
        </button>
        <button
          type="button"
          onClick={() => setTab("neighborhood")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            tab === "neighborhood"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Novo bairro
        </button>
      </div>

      {tab === "region" ? (
        <form onSubmit={handleCreateRegion} className="grid gap-3 sm:grid-cols-3">
          <input
            required
            placeholder="Cidade"
            value={regionCity}
            onChange={(e) => setRegionCity(e.target.value)}
            className={inputClass}
          />
          <input
            required
            placeholder="UF"
            maxLength={2}
            value={regionState}
            onChange={(e) => setRegionState(e.target.value.toUpperCase())}
            className={inputClass}
          />
          <input
            required
            placeholder="Nome da região (ex: Zona Oeste)"
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={isPending}
            className="sm:col-span-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Criar região"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreateNeighborhood} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Cidade"
            value={nbCity}
            onChange={(e) => setNbCity(e.target.value)}
            className={inputClass}
          />
          <input
            required
            placeholder="UF"
            maxLength={2}
            value={nbState}
            onChange={(e) => setNbState(e.target.value.toUpperCase())}
            className={inputClass}
          />
          <input
            required
            placeholder="Nome do bairro (ex: Centro)"
            value={nbName}
            onChange={(e) => setNbName(e.target.value)}
            className={inputClass}
          />
          <select
            value={nbRegionId}
            onChange={(e) => setNbRegionId(e.target.value)}
            className={inputClass}
          >
            <option value="">Região (opcional)</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.city}/{r.state}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="sm:col-span-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Criar bairro"}
          </button>
        </form>
      )}
    </div>
  )
}
