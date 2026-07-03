"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { cn } from "@/lib/utils"

/**
 * Subconjunto curado de ServiceType para os chips do Discovery mobile.
 * Labels reais (SERVICE_TYPE_LABELS) — nenhuma categoria inventada.
 */
const DISCOVER_CHIP_TYPES: ServiceType[] = [
  "DOG_WALK",
  "PET_SITTING",
  "BOARDING",
  "TRAINING",
  "HOME_CARE",
]

type DiscoverServiceChipsProps = {
  activeValue?: string
}

export function DiscoverServiceChips({ activeValue = "" }: DiscoverServiceChipsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function select(type: ServiceType | "") {
    const params = new URLSearchParams(searchParams.toString())
    if (type) {
      params.set("serviceType", type)
    } else {
      params.delete("serviceType")
    }
    params.delete("offset")
    startTransition(() => {
      router.push(`/discover?${params.toString()}`)
    })
  }

  const base =
    "shrink-0 cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
  const active = "border-primary bg-primary text-primary-foreground"
  const inactive =
    "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <button
        onClick={() => select("")}
        disabled={isPending}
        className={cn(base, !activeValue ? active : inactive)}
      >
        Todos
      </button>
      {DISCOVER_CHIP_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => select(type)}
          disabled={isPending}
          className={cn(base, activeValue === type ? active : inactive)}
        >
          {SERVICE_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  )
}
