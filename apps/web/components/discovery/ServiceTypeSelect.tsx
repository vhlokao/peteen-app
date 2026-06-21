"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types"
import { cn } from "@/lib/utils"

type ServiceTypeSelectProps = {
  defaultValue?: string
}

export function ServiceTypeSelect({ defaultValue = "" }: ServiceTypeSelectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const serviceType = e.target.value
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (serviceType) {
        params.set("serviceType", serviceType)
      } else {
        params.delete("serviceType")
      }
      params.delete("offset")
      router.push(`/discover?${params.toString()}`)
    })
  }

  return (
    <div className="relative">
      <select
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Tipo de serviço"
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-xs",
          "text-foreground placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <option value="">Todos os serviços</option>
        {SERVICE_TYPES.map((type) => (
          <option key={type} value={type}>
            {SERVICE_TYPE_LABELS[type as ServiceType]}
          </option>
        ))}
      </select>
      {/* Custom chevron */}
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
