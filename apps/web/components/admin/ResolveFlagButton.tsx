"use client"

import { useState, useTransition } from "react"
import { resolveFlagAction } from "@/modules/moderation/application/actions"

type Props = {
  flagId: string
  currentStatus: string
}

export function ResolveFlagButton({ flagId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  if (currentStatus !== "OPEN") {
    return (
      <span className="text-xs text-neutral-400 italic">—</span>
    )
  }

  const handle = (status: "RESOLVED" | "DISMISSED") => {
    startTransition(async () => {
      const res = await resolveFlagAction(flagId, status)
      setMessage(res.success ? "OK" : (res.error ?? "Erro"))
    })
  }

  if (message) {
    return <span className="text-xs text-green-600">{message}</span>
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handle("RESOLVED")}
        disabled={isPending}
        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Resolver
      </button>
      <button
        onClick={() => handle("DISMISSED")}
        disabled={isPending}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
      >
        Dispensar
      </button>
    </div>
  )
}
