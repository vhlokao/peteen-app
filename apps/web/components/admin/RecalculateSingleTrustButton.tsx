"use client"

import { useState, useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { recalculateSingleTrustAction } from "@/modules/backoffice/application/actions"

type Props = { professionalId: string }

export function RecalculateSingleTrustButton({ professionalId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleClick() {
    startTransition(async () => {
      const result = await recalculateSingleTrustAction(professionalId)
      if (result.success) {
        setDone(true)
        toast.success("Índice de Confiança recalculado")
      } else {
        toast.error(`Erro: ${result.error}`)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="Recalcular Índice de Confiança"
      className="text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
    >
      <RefreshCw
        className={`size-3.5 ${isPending ? "animate-spin" : ""} ${done ? "text-emerald-600" : ""}`}
      />
    </button>
  )
}
