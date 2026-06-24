"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { createTrustConnectionAction } from "@/modules/trust-graph/application/actions"
import {
  TRUST_CONNECTION_WEIGHTS,
  CONNECTION_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  CONNECTION_TYPES_BY_SOURCE,
} from "@/modules/trust-graph/domain/constants"
import type { TrustSourceType, TrustConnectionType } from "@/modules/trust-graph/domain/types"

type Professional = { id: string; displayName: string; city: string }
type PartnerOption = { id: string; businessName: string; city: string; slug: string }

type Props = {
  professionals: Professional[]
  partners?: PartnerOption[]
  onCreated?: () => void
}

export function CreateTrustConnectionForm({ professionals, partners = [], onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [sourceType, setSourceType] = useState<TrustSourceType>("PARTNER")
  const [sourcePartnerId, setSourcePartnerId] = useState("")
  const [sourceName, setSourceName] = useState("")
  const [sourceId, setSourceId] = useState("")
  const [targetId, setTargetId] = useState("")
  const [connectionType, setConnectionType] = useState<TrustConnectionType>(
    "PARTNER_RECOMMENDS_PROFESSIONAL"
  )

  const compatibleTypes = CONNECTION_TYPES_BY_SOURCE[sourceType] ?? []
  const defaultWeight   = TRUST_CONNECTION_WEIGHTS[connectionType]
  const selectedPartner = partners.find((p) => p.id === sourcePartnerId)

  function handleSourceTypeChange(val: TrustSourceType) {
    setSourceType(val)
    const types = CONNECTION_TYPES_BY_SOURCE[val]
    if (types?.length && types[0]) setConnectionType(types[0])
    setSourcePartnerId("")
    setSourceName("")
    setSourceId("")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!targetId) {
      setError("Selecione o profissional alvo.")
      return
    }

    let finalSourceId = sourceId.trim()
    let finalSourceName = sourceName.trim()
    let finalPartnerId: string | undefined

    if (sourceType === "PARTNER") {
      if (!sourcePartnerId && !finalSourceName) {
        setError("Selecione um parceiro cadastrado ou informe o nome (legado).")
        return
      }
      if (sourcePartnerId && selectedPartner) {
        finalPartnerId = selectedPartner.id
        finalSourceId = selectedPartner.id
        finalSourceName = selectedPartner.businessName
      } else if (!finalSourceName) {
        setError("Informe o nome da origem.")
        return
      } else {
        finalSourceId = finalSourceId || finalSourceName.toLowerCase().replace(/\s+/g, "-")
      }
    } else {
      if (!finalSourceName) {
        setError("Informe o nome da origem.")
        return
      }
      finalSourceId = finalSourceId || finalSourceName.toLowerCase().replace(/\s+/g, "-")
    }

    startTransition(async () => {
      const result = await createTrustConnectionAction({
        sourceType,
        sourceId:        finalSourceId,
        sourceName:      finalSourceName,
        sourcePartnerId: finalPartnerId,
        targetId,
        connectionType,
        weight: defaultWeight,
      })

      if (result.ok) {
        setSuccess(true)
        setSourcePartnerId("")
        setSourceName("")
        setSourceId("")
        setTargetId("")
        setTimeout(() => {
          setOpen(false)
          setSuccess(false)
        }, 1500)
        onCreated?.()
      } else {
        setError(result.error ?? "Erro ao criar conexão")
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        + Nova conexão
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Nova Conexão de Confiança</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Tipo de origem <span className="text-destructive">*</span>
            </label>
            <select
              value={sourceType}
              onChange={(e) => handleSourceTypeChange(e.target.value as TrustSourceType)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {(["PARTNER", "TUTOR", "PROFESSIONAL"] as TrustSourceType[]).map((t) => (
                <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Tipo de conexão <span className="text-destructive">*</span>
            </label>
            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value as TrustConnectionType)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {compatibleTypes.map((t) => (
                <option key={t} value={t}>{CONNECTION_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {sourceType === "PARTNER" ? (
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Parceiro <span className="text-destructive">*</span>
              </label>
              {partners.length > 0 ? (
                <select
                  value={sourcePartnerId}
                  onChange={(e) => setSourcePartnerId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione um parceiro…</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.businessName} — {p.city}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhum parceiro ativo.{" "}
                  <Link href="/admin/partners" className="text-primary hover:underline">
                    Cadastre em /admin/partners
                  </Link>
                </p>
              )}
              {partners.length === 0 && (
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="Nome legado (sem cadastro)"
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Nome da origem <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">ID (opcional)</label>
                <input
                  type="text"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Profissional alvo <span className="text-destructive">*</span>
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName} — {p.city}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Peso: <strong>+{defaultWeight} pts</strong> no Índice de Confiança
        </p>

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">✓ Conexão criada!</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {isPending ? "Criando…" : "Criar conexão"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
