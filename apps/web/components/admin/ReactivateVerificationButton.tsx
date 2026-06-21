"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { PlayCircle } from "lucide-react"
import { toast } from "sonner"

import { reactivateVerificationAction } from "@/modules/verification/application/actions"
import type { VerificationEntityType } from "@/modules/verification/domain/types"

type Props = {
  entityType: VerificationEntityType
  entityId: string
  entityName: string
}

export function ReactivateVerificationButton({
  entityType,
  entityId,
  entityName,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState("")

  function handleReactivate() {
    startTransition(async () => {
      const res = await reactivateVerificationAction({
        entityType,
        entityId,
        reason: reason.trim() || undefined,
      })
      if (res.ok) {
        toast.success("Verificação reativada.")
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
            onClick={handleReactivate}
            disabled={isPending}
            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Confirmar reativação
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
            `Reativar selo de verificação de "${entityName}"?`
          )
        ) {
          setShowForm(true)
        }
      }}
      disabled={isPending}
      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <PlayCircle className="size-3.5" />
      {isPending ? "…" : "Reativar"}
    </button>
  )
}
