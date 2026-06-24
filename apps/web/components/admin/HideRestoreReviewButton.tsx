"use client"

import { useState, useTransition } from "react"
import {
  hideReviewAction,
  restoreReviewAction,
} from "@/modules/moderation/application/actions"

type Props = {
  reviewId:      string
  hiddenByAdmin: boolean
}

export function HideRestoreReviewButton({ reviewId, hiddenByAdmin }: Props) {
  const [isPending, startTransition] = useTransition()
  const [localHidden, setLocalHidden] = useState(hiddenByAdmin)
  const [message, setMessage] = useState<string | null>(null)

  const handleHide = () => {
    const reason = window.prompt("Motivo para ocultar esta avaliação:")
    if (!reason) return

    startTransition(async () => {
      const res = await hideReviewAction(reviewId, reason)
      if (res.success) {
        setLocalHidden(true)
        setMessage("Ocultada")
      } else {
        setMessage(res.error ?? "Erro")
      }
    })
  }

  const handleRestore = () => {
    startTransition(async () => {
      const res = await restoreReviewAction(reviewId)
      if (res.success) {
        setLocalHidden(false)
        setMessage("Restaurada")
      } else {
        setMessage(res.error ?? "Erro")
      }
    })
  }

  if (message) {
    return (
      <span className="text-xs text-green-600">
        {message}
      </span>
    )
  }

  if (localHidden) {
    return (
      <button
        onClick={handleRestore}
        disabled={isPending}
        className="rounded border border-emerald-400 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
      >
        Restaurar
      </button>
    )
  }

  return (
    <button
      onClick={handleHide}
      disabled={isPending}
      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      Ocultar
    </button>
  )
}
