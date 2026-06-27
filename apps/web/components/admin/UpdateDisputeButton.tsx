"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { updateDisputeStatusAction } from "@/modules/disputes/application/actions"
import type { DisputeStatus } from "@/modules/disputes/domain/types"

type Props = {
  disputeId: string
  currentStatus: string
}

const TRANSITIONS: Record<
  string,
  Array<{ value: DisputeStatus; label: string; color: string }>
> = {
  OPEN: [{ value: "UNDER_REVIEW", label: "Em análise", color: "bg-blue-600" }],
  UNDER_REVIEW: [{ value: "RESOLVED", label: "Resolver", color: "bg-emerald-600" }],
}

export function UpdateDisputeButton({ disputeId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()

  const transitions = TRANSITIONS[currentStatus]
  if (!transitions) {
    return <span className="text-xs italic text-neutral-400">—</span>
  }

  const handle = (status: DisputeStatus) => {
    startTransition(async () => {
      const res = await updateDisputeStatusAction(disputeId, status)
      if (!res.success) {
        toast.error(res.error ?? "Erro ao atualizar disputa.")
        return
      }
      toast.success("A disputa foi atualizada.")
    })
  }

  return (
    <div className="flex gap-2">
      {transitions.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => handle(t.value)}
          disabled={isPending}
          className={`rounded px-2 py-1 text-xs text-white ${t.color} hover:opacity-80 disabled:opacity-50`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
