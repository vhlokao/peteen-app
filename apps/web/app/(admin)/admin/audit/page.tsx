import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminAuditAction } from "@/modules/backoffice/application/actions"
import {
  AUDIT_ACTION_COLORS,
  formatAuditActionLabel,
  formatAuditEntityDisplay,
  formatAuditEntityTypeLabel,
  formatAuditMetadataSummary,
  formatShortEntityId,
} from "@/modules/backoffice/domain/audit-labels"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"

const ENTITY_FILTER_OPTIONS = [
  "OperationalFlag",
  "Dispute",
  "Review",
  "PROFESSIONAL",
  "ProfessionalProfile",
  "PARTNER",
  "Partner",
  "TutorProfile",
  "Pet",
  "Service",
  "ServiceRequest",
  "TrustConnection",
  "ProfessionalAvailability",
] as const

type Props = {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const params = await searchParams
  const action = params.action
  const entityType = params.entityType

  const result = await getAdminAuditAction({ action, entityType })
  const logs = result.data ?? []

  const fmt = (d: Date) =>
    format(new Date(d), "dd/MM/yy HH:mm:ss", { locale: ptBR })

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Auditoria Administrativa"
        description="Trilha imutável de ações na plataforma — eventos técnicos com contexto legível para operação."
      />

      <form method="GET" className="flex flex-wrap gap-3">
        <input
          name="action"
          defaultValue={action ?? ""}
          placeholder="Filtrar por ação (ex: dispute.created)"
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />

        <select
          name="entityType"
          defaultValue={entityType ?? ""}
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">Todos os tipos</option>
          {ENTITY_FILTER_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {formatAuditEntityTypeLabel(type)}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded bg-neutral-800 px-4 py-1.5 text-sm text-white hover:bg-neutral-700"
        >
          Filtrar
        </button>
        <a
          href="/admin/audit"
          className="rounded border border-neutral-200 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Limpar
        </a>
      </form>

      <p className="text-sm text-neutral-500">
        {logs.length} registro{logs.length !== 1 ? "s" : ""} encontrado
        {logs.length !== 1 ? "s" : ""}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900/50">
            <tr>
              {["Ator", "Ação", "Tipo", "Entidade", "Detalhes", "Quando"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-neutral-400">
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const entityDisplay = formatAuditEntityDisplay(
                log.entityType,
                log.entityId,
                log.entityLabel
              )
              const metadataSummary = formatAuditMetadataSummary(log.action, log.metadata)

              return (
                <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                  <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                    <div className="flex flex-col gap-0.5">
                      <span>{log.actorEmail}</span>
                      <span className="text-[0.65rem] text-neutral-400">
                        {log.actorKind === "admin" ? "Admin" : "Usuário"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit rounded px-2 py-0.5 text-xs font-medium ${AUDIT_ACTION_COLORS[log.action] ?? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"}`}
                      >
                        {formatAuditActionLabel(log.action)}
                      </span>
                      <span className="font-mono text-[0.65rem] text-neutral-400">
                        {log.action}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                    {formatAuditEntityTypeLabel(log.entityType)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {entityDisplay.primary}
                      </p>
                      {entityDisplay.secondary ? (
                        <p className="text-xs text-neutral-500">{entityDisplay.secondary}</p>
                      ) : (
                        <p className="font-mono text-[0.65rem] text-neutral-400">
                          {formatShortEntityId(log.entityId)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[240px] px-4 py-3 text-xs text-neutral-500">
                    {metadataSummary ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                    {fmt(log.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
