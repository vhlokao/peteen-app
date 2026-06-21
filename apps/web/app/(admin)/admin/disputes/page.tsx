import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminDisputesAction } from "@/modules/backoffice/application/actions"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { UpdateDisputeButton } from "@/components/admin/UpdateDisputeButton"
import { DISPUTE_STATUS_LABELS } from "@/modules/moderation/domain/types"

const STATUS_COLORS: Record<string, string> = {
  OPEN:         "bg-red-100 text-red-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  RESOLVED:     "bg-green-100 text-green-700",
  REJECTED:     "bg-neutral-100 text-neutral-500",
}

type Props = {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdminDisputesPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status

  const result = await getAdminDisputesAction({ status })
  const disputes = result.data ?? []

  const fmt = (d: Date | null) =>
    d ? format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Disputas"
        description="Conflitos formalizados em solicitações de serviço. Resolva manualmente após análise."
      />

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="OPEN">Aberta</option>
          <option value="UNDER_REVIEW">Em análise</option>
          <option value="RESOLVED">Resolvida</option>
          <option value="REJECTED">Rejeitada</option>
        </select>

        <button
          type="submit"
          className="rounded bg-neutral-800 px-4 py-1.5 text-sm text-white hover:bg-neutral-700"
        >
          Filtrar
        </button>
        <a
          href="/admin/disputes"
          className="rounded border border-neutral-200 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Limpar
        </a>
      </form>

      <p className="text-sm text-neutral-500">
        {disputes.length} disputa{disputes.length !== 1 ? "s" : ""} encontrada{disputes.length !== 1 ? "s" : ""}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-100 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {["Solicitação", "Tutor", "Profissional", "Motivo", "Descrição", "Status", "Aberta em", "Ações"].map((h) => (
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
            {disputes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-400">
                  Nenhuma disputa encontrada.
                </td>
              </tr>
            )}
            {disputes.map((d) => (
              <tr key={d.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                  {d.requestId.slice(0, 10)}…
                </td>
                <td className="px-4 py-3 text-xs">{d.tutorName}</td>
                <td className="px-4 py-3 text-xs">{d.professionalName}</td>
                <td className="max-w-[140px] px-4 py-3 text-xs text-neutral-700">
                  {d.reason}
                </td>
                <td className="max-w-[180px] px-4 py-3 text-xs text-neutral-500">
                  {d.description ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status] ?? ""}`}>
                    {DISPUTE_STATUS_LABELS[d.status as keyof typeof DISPUTE_STATUS_LABELS] ?? d.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {fmt(d.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <UpdateDisputeButton
                    disputeId={d.id}
                    currentStatus={d.status}
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
