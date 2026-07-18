"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { cn } from "@/lib/utils"

const NAVY = "#1D2F6F"

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
    "shrink-0 cursor-pointer rounded-full border px-4 py-2 text-[13px] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50"
  const active = "border-transparent font-bold text-white shadow-[0_4px_14px_-2px_rgba(29,47,111,.4)]"
  const inactive =
    "border-border/70 bg-card font-medium text-muted-foreground hover:border-[#2C4893]/40 hover:text-foreground"

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <button
        onClick={() => select("")}
        disabled={isPending}
        className={cn(base, !activeValue ? active : inactive)}
        style={!activeValue ? { background: NAVY } : undefined}
      >
        Todos
      </button>
      {DISCOVER_CHIP_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => select(type)}
          disabled={isPending}
          className={cn(base, activeValue === type ? active : inactive)}
          style={activeValue === type ? { background: NAVY } : undefined}
        >
          {SERVICE_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  )
}
