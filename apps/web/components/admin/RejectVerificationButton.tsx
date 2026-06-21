"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { XCircle } from "lucide-react"
import { toast } from "sonner"

import { rejectVerificationAction } from "@/modules/verification/application/actions"

type Props = {
  requestId: string
  entityName: string
}

export function RejectVerificationButton({ requestId, entityName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState("")

  function handleReject() {
    if (!reason.trim()) {
      toast.error("Informe o motivo da rejeição.")
      return
    }

    startTransition(async () => {
      const res = await rejectVerificationAction(requestId, reason)
      if (res.ok) {
        toast.success("Verificação rejeitada.")
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
          placeholder="Motivo da rejeição *"
          rows={2}
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Confirmar
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
        if (window.confirm(`Rejeitar verificação de "${entityName}"?`)) {
          setShowForm(true)
        }
      }}
      disabled={isPending}
      className="inline-flex items-center gap-1 rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
    >
      <XCircle className="size-3.5" />
      Rejeitar
    </button>
  )
}
