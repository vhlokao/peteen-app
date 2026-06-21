import type { Metadata } from "next"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ShieldCheck } from "lucide-react"

import { requireAdmin } from "@/modules/identity/application/get-session"
import {
  getAdminVerificationMetricsAction,
  getAdminVerificationsAction,
} from "@/modules/verification/application/actions"
import {
  VERIFICATION_ENTITY_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_SEAL_LABELS,
} from "@/modules/verification/domain/constants"
import type {
  VerificationEntityType,
  VerificationRequestStatus,
} from "@/modules/verification/domain/types"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { ApproveVerificationButton } from "@/components/admin/ApproveVerificationButton"
import { RejectVerificationButton } from "@/components/admin/RejectVerificationButton"
import { SuspendVerificationButton } from "@/components/admin/SuspendVerificationButton"
import { ReactivateVerificationButton } from "@/components/admin/ReactivateVerificationButton"

export const metadata: Metadata = { title: "Admin — Fila de Verificações" }
export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<Record<string, string | undefined>>
}

const STATUS_STYLES: Record<VerificationRequestStatus, string> = {
  PENDING:  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  APPROVED: "bg-green-500/10 text-green-700 dark:text-green-400",
  REJECTED: "bg-red-500/10 text-red-700 dark:text-red-400",
}

export default async function AdminVerificationsPage({ searchParams }: Props) {
  await requireAdmin()
  const params = await searchParams

  const entityType = params.entityType as VerificationEntityType | undefined
  const status = params.status as VerificationRequestStatus | undefined

  const [metrics, rows] = await Promise.all([
    getAdminVerificationMetricsAction(),
    getAdminVerificationsAction({
      entityType: entityType || undefined,
      status: status || undefined,
    }),
  ])

  const fmt = (d: Date) => format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR })

  const filterLinks = [
    { href: "/admin/verifications", label: "Todos", active: !entityType && !status },
    { href: "/admin/verifications?status=PENDING", label: "Pendentes", active: status === "PENDING" },
    { href: "/admin/verifications?status=APPROVED", label: "Aprovadas", active: status === "APPROVED" },
    { href: "/admin/verifications?status=REJECTED", label: "Rejeitadas", active: status === "REJECTED" },
    { href: "/admin/verifications?entityType=PROFESSIONAL", label: "Profissionais", active: entityType === "PROFESSIONAL" && !status },
    { href: "/admin/verifications?entityType=PARTNER", label: "Parceiros", active: entityType === "PARTNER" && !status },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Fila de Verificações"
        description="Analise pedidos de verificação enviados por profissionais e parceiros."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Pendentes" value={metrics.pending} tone="amber" />
        <MetricCard label="Aprovadas" value={metrics.approved} tone="green" />
        <MetricCard label="Rejeitadas" value={metrics.rejected} tone="red" />
      </div>

      <div className="flex flex-wrap gap-2">
        {filterLinks.map(({ href, label, active }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Tipo", "Nome", "Solicitado em", "Status", "Análise", "Ações"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <ShieldCheck className="mx-auto mb-2 size-8 opacity-30" />
                  Nenhuma solicitação encontrada.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 text-xs">
                  {VERIFICATION_ENTITY_TYPE_LABELS[row.entityType]}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.entityName}</p>
                  <p className="font-mono text-[0.65rem] text-muted-foreground">
                    {row.entityId.slice(0, 10)}…
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {fmt(row.requestedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex w-fit rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                    >
                      {VERIFICATION_STATUS_LABELS[row.status]}
                    </span>
                    {row.status === "APPROVED" && (
                      <span
                        className={`text-[0.65rem] font-medium ${
                          row.entityIsSuspended
                            ? "text-amber-700 dark:text-amber-400"
                            : row.entityIsVerified
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {row.entityIsSuspended
                          ? VERIFICATION_SEAL_LABELS.suspended
                          : row.entityIsVerified
                            ? VERIFICATION_SEAL_LABELS.active
                            : "Selo inativo"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {row.reviewedAt ? (
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-foreground/80">Aprovação</p>
                        <p>{fmt(row.reviewedAt)}</p>
                        {row.reviewedByAdminEmail && (
                          <p className="text-[0.65rem]">por {row.reviewedByAdminEmail}</p>
                        )}
                      </div>
                      {row.lastLifecycleEvent && (
                        <div>
                          <p className="font-medium text-foreground/80">
                            {row.lastLifecycleEvent.action === "verification.suspended"
                              ? "Suspensão"
                              : "Reativação"}
                          </p>
                          <p>{fmt(row.lastLifecycleEvent.createdAt)}</p>
                          <p className="text-[0.65rem]">
                            por {row.lastLifecycleEvent.adminEmail}
                          </p>
                          {row.lastLifecycleEvent.reason && (
                            <p className="mt-1 text-amber-700 dark:text-amber-400">
                              Motivo: {row.lastLifecycleEvent.reason}
                            </p>
                          )}
                        </div>
                      )}
                      {row.rejectionReason && (
                        <p className="text-red-600 dark:text-red-400">
                          Motivo rejeição: {row.rejectionReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.status === "PENDING" ? (
                    <div className="flex flex-wrap items-start gap-2">
                      <ApproveVerificationButton
                        requestId={row.id}
                        entityName={row.entityName}
                      />
                      <RejectVerificationButton
                        requestId={row.id}
                        entityName={row.entityName}
                      />
                    </div>
                  ) : row.canSuspend ? (
                    <SuspendVerificationButton
                      entityType={row.entityType}
                      entityId={row.entityId}
                      entityName={row.entityName}
                    />
                  ) : row.canReactivate ? (
                    <ReactivateVerificationButton
                      entityType={row.entityType}
                      entityId={row.entityId}
                      entityName={row.entityName}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Concluída</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "amber" | "green" | "red"
}) {
  const colors = {
    amber: "text-amber-600",
    green: "text-green-600",
    red: "text-red-600",
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className={`text-2xl font-black tabular-nums ${colors[tone]}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
