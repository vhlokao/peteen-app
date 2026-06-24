import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminAuditAction } from "@/modules/backoffice/application/actions"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"

const ACTION_COLORS: Record<string, string> = {
  "flag.create":   "bg-orange-100 text-orange-700",
  "flag.resolve":  "bg-green-100 text-green-700",
  "dispute.update":"bg-blue-100 text-blue-700",
  "review.hide":   "bg-red-100 text-red-700",
  "review.restore":"bg-emerald-100 text-emerald-700",
  "trust.recalculate": "bg-purple-100 text-purple-700",
  "verification.approved": "bg-emerald-100 text-emerald-700",
  "verification.rejected": "bg-red-100 text-red-700",
  "verification.suspended": "bg-amber-100 text-amber-700",
  "verification.reactivated": "bg-sky-100 text-sky-700",
  "tutor.profile_updated": "bg-teal-100 text-teal-700",
  "professional.profile_updated": "bg-indigo-100 text-indigo-700",
  "pet.created": "bg-emerald-100 text-emerald-700",
  "pet.updated": "bg-sky-100 text-sky-700",
  "pet.archived": "bg-neutral-200 text-neutral-700",
  "professional.service_created": "bg-emerald-100 text-emerald-700",
  "professional.service_updated": "bg-sky-100 text-sky-700",
  "professional.service_activated": "bg-green-100 text-green-700",
  "professional.service_deactivated": "bg-amber-100 text-amber-700",
}

type Props = {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const params = await searchParams
  const action     = params.action
  const entityType = params.entityType

  const result = await getAdminAuditAction({ action, entityType })
  const logs = result.data ?? []

  const fmt = (d: Date) =>
    format(new Date(d), "dd/MM/yy HH:mm:ss", { locale: ptBR })

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Auditoria Administrativa"
        description="Trilha imutável de ações de admins no backoffice e de usuários na plataforma (pets, perfil de tutor)."
      />

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          name="action"
          defaultValue={action ?? ""}
          placeholder="Filtrar por ação (ex: review.hide)"
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm"
        />

        <select
          name="entityType"
          defaultValue={entityType ?? ""}
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="OperationalFlag">Flag</option>
          <option value="Dispute">Disputa</option>
          <option value="Review">Avaliação</option>
          <option value="PROFESSIONAL">Profissional</option>
          <option value="PARTNER">Parceiro</option>
          <option value="TutorProfile">Perfil de tutor</option>
          <option value="ProfessionalProfile">Perfil profissional</option>
          <option value="Pet">Pet</option>
          <option value="Service">Serviço</option>
        </select>

        <button
          type="submit"
          className="rounded bg-neutral-800 px-4 py-1.5 text-sm text-white hover:bg-neutral-700"
        >
          Filtrar
        </button>
        <a
          href="/admin/audit"
          className="rounded border border-neutral-200 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Limpar
        </a>
      </form>

      <p className="text-sm text-neutral-500">
        {logs.length} registro{logs.length !== 1 ? "s" : ""} encontrado{logs.length !== 1 ? "s" : ""}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-100 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {["Ator", "Ação", "Tipo", "Entidade", "Metadata", "Quando"].map((h) => (
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
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 text-xs text-neutral-600">
                  <div className="flex flex-col gap-0.5">
                    <span>{log.actorEmail}</span>
                    <span className="text-[0.65rem] text-neutral-400">
                      {log.actorKind === "admin" ? "admin" : "usuário"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-mono font-medium ${ACTION_COLORS[log.action] ?? "bg-neutral-100 text-neutral-600"}`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {log.entityType}
                </td>
                <td className="px-4 py-3">
                  {log.entityLabel ? (
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {log.entityLabel}
                      </p>
                      <p className="font-mono text-[0.65rem] text-neutral-400">
                        {log.entityId}
                      </p>
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-neutral-500">
                      {log.entityId}
                    </span>
                  )}
                </td>
                <td className="max-w-[200px] px-4 py-3 text-xs text-neutral-400">
                  {log.metadata
                    ? JSON.stringify(log.metadata).slice(0, 80)
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                  {fmt(log.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
