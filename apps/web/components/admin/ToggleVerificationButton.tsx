"use client"

import { useState, useTransition } from "react"
import { setVerifiedProfileAction } from "@/modules/moderation/application/actions"

type Props = {
  professionalId: string
  isVerified:     boolean
}

export function ToggleVerificationButton({ professionalId, isVerified }: Props) {
  const [isPending, startTransition] = useTransition()
  const [localVerified, setLocalVerified] = useState(isVerified)
  const [message, setMessage] = useState<string | null>(null)

  const handle = () => {
    const next = !localVerified
    const confirm = window.confirm(
      next
        ? "Ativar Perfil Verificado para este profissional?"
        : "Remover Perfil Verificado? O badge será removido imediatamente."
    )
    if (!confirm) return

    startTransition(async () => {
      const res = await setVerifiedProfileAction(professionalId, next)
      if (res.success) {
        setLocalVerified(next)
        setMessage(next ? "Verificado" : "Removido")
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage(res.error ?? "Erro")
      }
    })
  }

  if (message) {
    return (
      <span className={`text-xs font-medium ${message === "Verificado" ? "text-emerald-600" : message === "Removido" ? "text-neutral-500" : "text-red-600"}`}>
        {message}
      </span>
    )
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
        localVerified
          ? "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
          : "bg-emerald-600 text-white hover:bg-emerald-700"
      }`}
    >
      {localVerified ? "Remover verificação" : "Verificar perfil"}
    </button>
  )
}
