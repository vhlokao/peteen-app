"use client"

import { useState, useTransition } from "react"
import { updateDisputeAction } from "@/modules/moderation/application/actions"

type Props = {
  disputeId:     string
  currentStatus: string
}

const TRANSITIONS: Record<string, Array<{ value: string; label: string; color: string }>> = {
  OPEN: [
    { value: "UNDER_REVIEW", label: "Em análise", color: "bg-blue-600" },
    { value: "REJECTED",     label: "Rejeitar",   color: "bg-red-600" },
  ],
  UNDER_REVIEW: [
    { value: "RESOLVED", label: "Resolver",  color: "bg-emerald-600" },
    { value: "REJECTED", label: "Rejeitar",  color: "bg-red-600" },
  ],
}

export function UpdateDisputeButton({ disputeId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const transitions = TRANSITIONS[currentStatus]
  if (!transitions) {
    return <span className="text-xs text-neutral-400 italic">—</span>
  }

  if (message) {
    return <span className="text-xs text-green-600">{message}</span>
  }

  const handle = (status: string) => {
    startTransition(async () => {
      const res = await updateDisputeAction(
        disputeId,
        status as "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED"
      )
      setMessage(res.success ? "Atualizado" : (res.error ?? "Erro"))
    })
  }

  return (
    <div className="flex gap-2">
      {transitions.map((t) => (
        <button
          key={t.value}
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
