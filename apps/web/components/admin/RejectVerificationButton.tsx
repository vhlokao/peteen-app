"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo da rejeição *"
          rows={2}
          disabled={isPending}
          className="text-xs"
        />
        <div className="flex gap-1">
          {/* "Confirmar" antes ficava com o MESMO texto durante o envio —
              disabled sozinho não avisa que algo está acontecendo (item 5:
              "evitar botão parecer congelado depois do clique"). */}
          <Button
            type="button"
            size="xs"
            variant="destructive"
            onClick={handleReject}
            pending={isPending}
            pendingText="Rejeitando…"
          >
            Confirmar
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setShowForm(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      type="button"
      size="xs"
      variant="destructive"
      onClick={() => {
        if (window.confirm(`Rejeitar verificação de "${entityName}"?`)) {
          setShowForm(true)
        }
      }}
      disabled={isPending}
      className="gap-1"
    >
      <XCircle />
      Rejeitar
    </Button>
  )
}
