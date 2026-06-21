"use client"

import { useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { recalculateAllTrustAction } from "@/modules/backoffice/application/actions"

export function RecalculateAllTrustButton() {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm("Recalcular Trust Score de TODOS os profissionais? Pode demorar alguns segundos.")) return

    startTransition(async () => {
      const result = await recalculateAllTrustAction()
      if (result.success && result.report) {
        const { total, success, failed, durationMs } = result.report
        toast.success(
          `Concluído em ${durationMs}ms — ${success}/${total} atualizados${failed > 0 ? `, ${failed} com erro` : ""}`
        )
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
      className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Recalculando…" : "Recalcular todos"}
    </button>
  )
}
