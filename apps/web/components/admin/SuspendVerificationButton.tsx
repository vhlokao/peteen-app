"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { PauseCircle } from "lucide-react"
import { toast } from "sonner"

import { suspendVerificationAction } from "@/modules/verification/application/actions"
import type { VerificationEntityType } from "@/modules/verification/domain/types"

type Props = {
  entityType: VerificationEntityType
  entityId: string
  entityName: string
}

export function SuspendVerificationButton({
  entityType,
  entityId,
  entityName,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState("")

  function handleSuspend() {
    startTransition(async () => {
      const res = await suspendVerificationAction({
        entityType,
        entityId,
        reason: reason.trim() || undefined,
      })
      if (res.ok) {
        toast.success("Verificação suspensa.")
        setShowForm(false)
        setReason("")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  if (showForm) {
    return (
      <div className="flex min-w-[220px] flex-col gap-2">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          rows={2}
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleSuspend}
            disabled={isPending}
            className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Confirmar suspensão
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded border px-2 py-1 text-xs text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (
          window.confirm(
            `Suspender selo de verificação de "${entityName}"? O selo será removido do perfil público.`
          )
        ) {
          setShowForm(true)
        }
      }}
      disabled={isPending}
      className="inline-flex items-center gap-1 rounded border border-amber-400 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
    >
      <PauseCircle className="size-3.5" />
      {isPending ? "…" : "Suspender"}
    </button>
  )
}
