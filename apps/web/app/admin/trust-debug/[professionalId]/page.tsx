/**
 * /admin/trust-debug/[professionalId]
 *
 * Página de auditoria do Trust Engine. Apenas desenvolvimento.
 * Exibe score, level, breakdown completo e metadados de cálculo.
 *
 * Remover ou proteger com autenticação de admin antes de ir para produção.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, RefreshCw, Shield, TrendingUp, Users } from "lucide-react"
import Link from "next/link"

import { calculateTrustScore } from "@/modules/trust-engine/application/calculate-trust-score"
import { prisma } from "@/lib/prisma/client"
import { TRUST_LEVEL_LABELS } from "@/modules/professional/domain/types"
import { REFERENCE_WEIGHTS, RECURRENCE_SESSION_BONUS } from "@/modules/trust-engine/domain/constants"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "Trust Debug",
}

// Force dynamic rendering — dados em tempo real
export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ professionalId: string }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de exibição
// ─────────────────────────────────────────────────────────────────────────────

function formatValue(n: number): string {
  if (n === 0) return "0"
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

function formatDate(d: Date | null): string {
  if (!d) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d))
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function TrustDebugPage({ params }: PageProps) {
  const { professionalId } = await params

  const [profile, trust] = await Promise.all([
    prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: {
        displayName: true,
        trustScore: true,
        trustLevel: true,
        trustUpdatedAt: true,
        userId: true,
        isVerified: true,
        verifiedIdentity: true,
        verifiedAt: true,
      },
    }),
    calculateTrustScore(professionalId),
  ])

  if (!profile) notFound()

  // Busca TrustEvents para log detalhado
  const events = await prisma.trustEvent.findMany({
    where: { targetId: profile.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      weight: true,
      isFlagged: true,
      createdAt: true,
      relatedRequestId: true,
      relatedReviewId: true,
    },
    take: 50,
  })

  const LEVEL_COLORS: Record<string, string> = {
    INITIAL:     "text-muted-foreground",
    BUILDING:    "text-blue-600 dark:text-blue-400",
    ESTABLISHED: "text-teal-600 dark:text-teal-400",
    TRUSTED:     "text-green-600 dark:text-green-400",
    ELITE:       "text-amber-600 dark:text-amber-400",
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/trust"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar para Trust Engine
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">Trust Debug</h1>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Dev only
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.displayName} · <span className="font-mono text-xs">{professionalId.slice(0, 12)}…</span>
        </p>
      </div>

      {/* Score principal */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Score atual (calculado agora)
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-5xl font-black tabular-nums text-foreground">
            {trust.score.toFixed(1)}
          </span>
          <div>
            <span className={`text-lg font-bold ${LEVEL_COLORS[trust.level] ?? ""}`}>
              {TRUST_LEVEL_LABELS[trust.level as keyof typeof TRUST_LEVEL_LABELS]}
            </span>
            <p className="text-xs text-muted-foreground">
              Score persistido: {profile.trustScore.toFixed(1)}
              {Math.abs(trust.score - profile.trustScore) > 0.01 && (
                <span className="ml-1 text-amber-500">
                  ⚠ divergência — hook não executou ainda
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${trust.score}%` }}
          />
        </div>
      </section>

      {/* Breakdown */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Breakdown
        </h2>
        <p className="mb-4 text-[0.7rem] text-muted-foreground">
          rawScore = reviews + completions + recurrence + bonuses + identityVerified + penalties + trustGraphBonus
        </p>

        <div className="divide-y divide-border">
          <Row label="Reviews"          value={<span className={trust.breakdown.reviews > 0 ? "text-green-600 dark:text-green-400" : ""}>{formatValue(trust.breakdown.reviews)}</span>} />
          <Row label="Conclusões"       value={<span className={trust.breakdown.completions > 0 ? "text-green-600 dark:text-green-400" : ""}>{formatValue(trust.breakdown.completions)}</span>} />
          <Row label="Recorrência"      value={<span className={trust.breakdown.recurrence > 0 ? "text-primary" : ""}>{formatValue(trust.breakdown.recurrence)}</span>} />
          <Row label="Bônus"            value={formatValue(trust.breakdown.bonuses)} />
          <Row
            label="Identidade verificada"
            value={
              trust.breakdown.identityVerified > 0 ? (
                <span className="text-green-600 dark:text-green-400">
                  {formatValue(trust.breakdown.identityVerified)}
                </span>
              ) : (
                <span className="text-muted-foreground">— não aplicada</span>
              )
            }
          />
          <Row label="Penalidades"      value={<span className={trust.breakdown.penalties < 0 ? "text-destructive" : ""}>{formatValue(trust.breakdown.penalties)}</span>} />
          <Row label="Trust Graph 🤝"   value={<span className={trust.breakdown.trustGraphBonus > 0 ? "text-violet-600 dark:text-violet-400" : ""}>{formatValue(trust.breakdown.trustGraphBonus)}</span>} />
        </div>

        <Separator className="my-3" />

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Total (clamped 0–100)</span>
          <span className="text-base font-black tabular-nums">{trust.score.toFixed(1)}</span>
        </div>
      </section>

      {/* Metadados */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <TrendingUp className="size-3.5" />
          Metadados
        </h2>
        <div className="divide-y divide-border">
          <Row label="TrustEvents processados"    value={trust.meta.totalEvents} />
          <Row label="Atendimentos concluídos"    value={trust.meta.totalCompletedRequests} />
          <Row label="Tutores recorrentes únicos" value={<span className="flex items-center gap-1"><Users className="size-3" />{trust.meta.uniqueRecurringTutors}</span>} />
          <Row label="Última atualização (DB)"    value={formatDate(profile.trustUpdatedAt)} />
          <Row label="Perfil verificado"          value={profile.isVerified ? "Sim" : "Não"} />
          <Row label="Identidade verificada"      value={profile.verifiedIdentity ? "Sim" : "Não"} />
          <Row label="Verificado em"              value={formatDate(profile.verifiedAt)} />
        </div>
      </section>

      {/* Territorial — Etapa 6.0 (metadata, não altera score) */}
      {trust.meta.territorial && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Território local
          </h2>
          <div className="divide-y divide-border">
            <Row label="Bairro"  value={trust.meta.territorial.neighborhood ?? "—"} />
            <Row label="Região"  value={trust.meta.territorial.region ?? "—"} />
            <Row label="Cidade"  value={`${trust.meta.territorial.city} / ${trust.meta.territorial.state}`} />
            <Row
              label="Posição no bairro"
              value={
                trust.meta.territorial.rankInNeighborhood
                  ? `Top ${trust.meta.territorial.rankInNeighborhood} de ${trust.meta.territorial.totalInNeighborhood}`
                  : "—"
              }
            />
            <Row
              label="Posição na cidade"
              value={
                trust.meta.territorial.rankInCity
                  ? `Top ${Math.min(trust.meta.territorial.rankInCity, 10)}${trust.meta.territorial.rankInCity <= 5 ? " (Top 5)" : ""} de ${trust.meta.territorial.totalInCity}`
                  : "—"
              }
            />
          </div>
        </section>
      )}

      {/* Trust Events log */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          TrustEvents recentes ({events.length})
        </h2>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum TrustEvent registrado.</p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div
                key={e.id}
                className={`flex items-start justify-between gap-3 rounded-lg p-2.5 text-xs ${
                  e.isFlagged
                    ? "border border-destructive/30 bg-destructive/5"
                    : "bg-muted/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{e.type}</span>
                    {e.isFlagged && (
                      <span className="rounded bg-destructive/20 px-1 text-[0.6rem] font-bold text-destructive">
                        FLAGGED — excluído do cálculo
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                    }).format(new Date(e.createdAt))}
                  </span>
                </div>
                <span
                  className={`shrink-0 font-bold tabular-nums ${
                    e.weight > 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
                  }`}
                >
                  {formatValue(e.weight)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tabela de referência */}
      <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pesos de referência (constants.ts)
        </h2>
        <div className="divide-y divide-border/50 text-xs">
          {Object.entries(REFERENCE_WEIGHTS).map(([key, val]) => (
            <div key={key} className="flex justify-between py-1.5">
              <span className="font-mono text-muted-foreground">{key}</span>
              <span className={`font-bold ${val > 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {val > 0 ? `+${val}` : val}
              </span>
            </div>
          ))}
        </div>

        <Separator className="my-3" />

        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Bônus de recorrência por sessão
        </p>
        <div className="flex gap-2">
          {RECURRENCE_SESSION_BONUS.map((bonus, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 rounded bg-muted px-2 py-1">
              <span className="text-[0.6rem] text-muted-foreground">
                {i + 1}{i === RECURRENCE_SESSION_BONUS.length - 1 ? "+" : ""}ª
              </span>
              <span className="text-xs font-bold text-primary">+{bonus}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Aviso */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/10 dark:text-amber-400">
        <RefreshCw className="mb-1 inline size-3" />
        {" "}Esta página força dynamic rendering e recalcula o score a cada acesso.
        O score exibido reflete o estado atual do banco. Proteger ou remover antes da produção.
      </div>
    </div>
  )
}
