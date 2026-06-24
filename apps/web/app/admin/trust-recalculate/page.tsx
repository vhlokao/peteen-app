/**
 * /admin/trust-recalculate
 *
 * Backfill do Trust Engine — recalcula trustScore de todos os profissionais.
 *
 * Quando usar:
 *   - Profissionais criados antes do hook updateProfessionalTrust existir
 *   - Após ajuste de pesos em trust-engine/domain/constants.ts
 *   - Após migração de dados
 *
 * Dev only — remover ou proteger com auth de admin antes da produção.
 */

import type { Metadata } from "next"
import { ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react"
import Link from "next/link"

import { prisma } from "@/lib/prisma/client"
import { RecalculateButton } from "./RecalculateButton"

export const metadata: Metadata = { title: "Recalcular Índice de Confiança" }

export default async function TrustRecalculatePage() {
  const stats = await prisma.professionalProfile.aggregate({
    where: { deletedAt: null },
    _count: true,
    _avg: { trustScore: true },
    _min: { trustScore: true },
    _max: { trustScore: true },
  })

  const outdated = await prisma.professionalProfile.count({
    where: { deletedAt: null, trustUpdatedAt: null },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div>
        <Link
          href="/discover"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
        <div className="flex items-center gap-2">
          <RefreshCw className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">Recalcular Índice de Confiança</h1>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Dev only
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Recalcula e persiste o Índice de Confiança de todos os profissionais ativos.
        </p>
      </div>

      {/* Alerta se há profissionais sem trustUpdatedAt */}
      {outdated > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-900/10">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {outdated} profissional{outdated !== 1 ? "is" : ""} com Índice de Confiança desatualizado
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              trustUpdatedAt é null — o hook updateProfessionalTrust ainda não rodou para eles.
            </p>
          </div>
        </div>
      )}

      {/* Estado atual */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estado atual no banco
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: stats._count },
            { label: "Sem recalc.", value: outdated, warn: outdated > 0 },
            { label: "Score médio", value: (stats._avg.trustScore ?? 0).toFixed(1) },
            { label: "Score máx.", value: (stats._max.trustScore ?? 0).toFixed(1) },
          ].map(({ label, value, warn }) => (
            <div key={label} className="rounded-xl bg-muted/50 p-3 text-center">
              <p className={`text-lg font-bold tabular-nums ${warn ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {value}
              </p>
              <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ação */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Executar backfill
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Processa cada profissional sequencialmente. O resultado aparece abaixo.
          A operação é idempotente — pode ser executada múltiplas vezes com segurança.
        </p>
        <RecalculateButton />
      </section>

      {/* Debug links */}
      <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-2">Links úteis</p>
        <p>Detalhes por profissional: <code className="font-mono">/admin/trust-debug/[professionalId]</code></p>
        <p className="mt-1">Discovery: <Link href="/discover" className="text-primary underline">/discover</Link></p>
      </div>
    </div>
  )
}
