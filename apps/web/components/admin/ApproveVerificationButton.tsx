"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { approveVerificationAction } from "@/modules/verification/application/actions"

type Props = {
  requestId: string
  entityName: string
}

export function ApproveVerificationButton({ requestId, entityName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    if (!window.confirm(`Aprovar verificação de "${entityName}"?`)) return

    startTransition(async () => {
      const res = await approveVerificationAction(requestId)
      if (res.ok) {
        toast.success("Verificação aprovada.")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleApprove}
      disabled={isPending}
      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <CheckCircle2 className="size-3.5" />
      {isPending ? "…" : "Aprovar"}
    </button>
  )
}
