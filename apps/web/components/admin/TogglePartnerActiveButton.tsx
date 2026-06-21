"use client"

import { useState, useTransition } from "react"
import { setPartnerActiveAction } from "@/modules/partners/application/actions"

type Props = {
  id: string
  isActive: boolean
}

export function TogglePartnerActiveButton({ id, isActive }: Props) {
  const [active, setActive] = useState(isActive)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    setError(null)
    startTransition(async () => {
      const result = await setPartnerActiveAction(id, !active)
      if (result.ok) setActive((prev) => !prev)
      else setError(result.error ?? "Erro")
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          active
            ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        } disabled:opacity-50`}
      >
        {isPending ? "…" : active ? "Ativo" : "Inativo"}
      </button>
      {error && <span className="text-[0.65rem] text-destructive">{error}</span>}
    </div>
  )
}
