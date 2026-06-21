"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setTrustConnectionActiveAction } from "@/modules/trust-graph/application/actions"

type Props = {
  id: string
  isActive: boolean
}

export function ToggleTrustConnectionButton({ id, isActive }: Props) {
  const router = useRouter()
  const [active, setActive] = useState(isActive)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    setError(null)
    const nextActive = !active

    startTransition(async () => {
      const result = await setTrustConnectionActiveAction(id, nextActive)
      if (result.ok) {
        setActive(nextActive)
        toast.success(nextActive ? "Conexão reativada" : "Conexão desativada")
        router.refresh()
      } else {
        const message = result.error ?? "Erro ao atualizar conexão"
        setError(message)
        toast.error(message)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-label={active ? "Desativar conexão" : "Reativar conexão"}
        className={`min-w-[5.5rem] rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
          active
            ? "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/40"
            : "border-green-300 bg-green-100 text-green-900 hover:bg-green-200 dark:border-green-700 dark:bg-green-950/50 dark:text-green-200 dark:hover:bg-green-900/40"
        } disabled:opacity-50`}
      >
        {isPending ? "Salvando…" : active ? "Desativar" : "Reativar"}
      </button>
      {error && <span className="max-w-[10rem] text-right text-[0.65rem] text-destructive">{error}</span>}
    </div>
  )
}
