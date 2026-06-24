import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminFlagsAction } from "@/modules/backoffice/application/actions"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import { ResolveFlagButton } from "@/components/admin/ResolveFlagButton"
import {
  FLAG_SEVERITY_LABELS,
  FLAG_SOURCE_LABELS,
  FLAG_STATUS_LABELS,
} from "@/modules/moderation/domain/types"

const SEVERITY_COLORS: Record<string, string> = {
  LOW:      "bg-blue-100 text-blue-700",
  MEDIUM:   "bg-yellow-100 text-yellow-700",
  HIGH:     "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:      "bg-red-100 text-red-700",
  RESOLVED:  "bg-green-100 text-green-700",
  DISMISSED: "bg-neutral-100 text-neutral-500",
}

const SOURCE_COLORS: Record<string, string> = {
  SYSTEM:      "bg-purple-100 text-purple-700",
  USER_REPORT: "bg-sky-100 text-sky-700",
  ADMIN:       "bg-amber-100 text-amber-700",
}

type Props = {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdminFlagsPage({ searchParams }: Props) {
  const params = await searchParams
  const status     = params.status
  const severity   = params.severity
  const targetType = params.targetType

  const result = await getAdminFlagsAction({ status, severity, targetType })
  const flags = result.data ?? []

  const fmt = (d: Date | null) =>
    d ? format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Flags Operacionais"
        description="Sinais de comportamento incomum gerados pelo sistema, usuários ou admins."
      />

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="OPEN">Abertos</option>
          <option value="RESOLVED">Resolvidos</option>
          <option value="DISMISSED">Dispensados</option>
        </select>

        <select
          name="severity"
          defaultValue={severity ?? ""}
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Toda severidade</option>
          <option value="LOW">Baixo</option>
          <option value="MEDIUM">Médio</option>
          <option value="HIGH">Alto</option>
          <option value="CRITICAL">Crítico</option>
        </select>

        <select
          name="targetType"
          defaultValue={targetType ?? ""}
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="USER">Usuário</option>
          <option value="PROFESSIONAL">Profissional</option>
          <option value="REVIEW">Avaliação</option>
          <option value="REQUEST">Solicitação</option>
        </select>

        <button
          type="submit"
          className="rounded bg-neutral-800 px-4 py-1.5 text-sm text-white hover:bg-neutral-700"
        >
          Filtrar
        </button>
        <a
          href="/admin/flags"
          className="rounded border border-neutral-200 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Limpar
        </a>
      </form>

      {/* Contagem */}
      <p className="text-sm text-neutral-500">
        {flags.length} flag{flags.length !== 1 ? "s" : ""} encontrada{flags.length !== 1 ? "s" : ""}
      </p>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-100 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {["Alvo", "Tipo", "Motivo", "Severidade", "Origem", "Status", "Criado em", "Ações"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50 bg-white">
            {flags.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-400">
                  Nenhuma flag encontrada.
                </td>
              </tr>
            )}
            {flags.map((flag) => (
              <tr key={flag.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                  {flag.targetId.slice(0, 12)}…
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                    {flag.targetType}
                  </span>
                </td>
                <td className="max-w-[200px] px-4 py-3 text-xs text-neutral-700">
                  {flag.reason}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[flag.severity] ?? ""}`}>
                    {FLAG_SEVERITY_LABELS[flag.severity as keyof typeof FLAG_SEVERITY_LABELS] ?? flag.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[flag.source] ?? ""}`}>
                    {FLAG_SOURCE_LABELS[flag.source as keyof typeof FLAG_SOURCE_LABELS] ?? flag.source}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[flag.status] ?? ""}`}>
                    {FLAG_STATUS_LABELS[flag.status as keyof typeof FLAG_STATUS_LABELS] ?? flag.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {fmt(flag.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <ResolveFlagButton
                    flagId={flag.id}
                    currentStatus={flag.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
