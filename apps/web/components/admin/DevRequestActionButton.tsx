"use client"

import { useState, useTransition } from "react"
import {
  devCancelServiceRequestAction,
  devExpireServiceRequestAction,
  devClearActiveRequestsBetweenAction,
} from "@/modules/service-request/application/dev-actions"

// ─── Cancelar individual ─────────────────────────────────────────────────────

type CancelProps = { requestId: string; status: string }

export function DevCancelButton({ requestId, status }: CancelProps) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  if (status === "COMPLETED" || status === "DISPUTED") return null

  const label = status === "IN_PROGRESS" ? "Cancelar (DEV)" : "Cancelar"

  const handle = () => {
    startTransition(async () => {
      const res = await devCancelServiceRequestAction(requestId)
      setMsg(res.success ? "Cancelado ✓" : (res.error ?? "Erro"))
      if (res.success) window.location.reload()
    })
  }

  if (msg) return <span className="text-xs text-green-600">{msg}</span>

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
    >
      {isPending ? "…" : label}
    </button>
  )
}

// ─── Expirar individual ───────────────────────────────────────────────────────

type ExpireProps = { requestId: string; status: string }

export function DevExpireButton({ requestId, status }: ExpireProps) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  if (status !== "PENDING" && status !== "ACCEPTED") return null

  const handle = () => {
    startTransition(async () => {
      const res = await devExpireServiceRequestAction(requestId)
      setMsg(res.success ? "Expirado ✓" : (res.error ?? "Erro"))
      if (res.success) window.location.reload()
    })
  }

  if (msg) return <span className="text-xs text-amber-600">{msg}</span>

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="rounded border border-amber-400 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
    >
      {isPending ? "…" : "Expirar"}
    </button>
  )
}

// ─── Limpar par ───────────────────────────────────────────────────────────────

type ClearPairProps = { tutorId: string; professionalId: string }

export function DevClearPairButton({ tutorId, professionalId }: ClearPairProps) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const handle = () => {
    if (!confirm("Limpar TODAS as solicitações ativas entre este par? (DEV ONLY)")) return
    startTransition(async () => {
      const res = await devClearActiveRequestsBetweenAction(tutorId, professionalId)
      setMsg(
        res.success
          ? `${res.data?.cleared ?? 0} limpas ✓`
          : (res.error ?? "Erro")
      )
      if (res.success) window.location.reload()
    })
  }

  if (msg) return <span className="text-xs text-blue-600">{msg}</span>

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="rounded border border-blue-400 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"
    >
      {isPending ? "…" : "Limpar par"}
    </button>
  )
}
