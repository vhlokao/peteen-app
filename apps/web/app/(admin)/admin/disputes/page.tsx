import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Info, ShieldAlert } from "lucide-react"

import { getAdminDisputesListAction } from "@/modules/disputes/application/actions"
import { formatShortId } from "@/modules/disputes/domain/formatters"
import { DisputeStatusBadge } from "@/modules/disputes/components/dispute-status-badge"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { UpdateDisputeButton } from "@/components/admin/UpdateDisputeButton"

type Props = {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdminDisputesPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status

  const result = await getAdminDisputesListAction({ status })
  const disputes = result.success ? result.data : []

  const fmt = (d: Date | null) =>
    d ? format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Disputas"
        description="Conflitos reportados por tutores em solicitações de serviço. Análise manual pela equipe Peteen."
      />

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/40 dark:bg-blue-900/10">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">
              Disputas abertas precisam de análise manual da equipe Peteen.
            </p>
            <p className="text-muted-foreground">
              Uma disputa aberta ainda{" "}
              <span className="font-medium text-foreground">
                não altera o Índice de Confiança
              </span>{" "}
              do profissional. Trate cada caso como sinal operacional, não como
              punição automática.
            </p>
          </div>
        </div>
      </div>

      <form method="GET" className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
          className="rounded border border-neutral-200 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Limpar
        </a>
      </form>

      {disputes.length > 0 ? (
        <p className="text-sm text-neutral-500">
          {disputes.length} disputa{disputes.length !== 1 ? "s" : ""} encontrada
          {disputes.length !== 1 ? "s" : ""}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900/50">
            <tr>
              {[
                "Tutor",
                "Profissional",
                "Serviço",
                "Solicitação",
                "Motivo",
                "Status",
                "Aberta em",
                "Atualizada em",
                "Ações",
              ].map((h) => (
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
            {disputes.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                    <ShieldAlert className="size-8 text-neutral-300 dark:text-neutral-600" />
                    <div>
                      <p className="font-medium text-neutral-700 dark:text-neutral-300">
                        Nenhuma disputa encontrada.
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        Quando um tutor reportar um problema, ele aparecerá aqui para
                        análise.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {disputes.map((d) => (
              <tr key={d.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                <td className="px-4 py-3 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  {d.tutorName}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300">
                  {d.professionalName}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300">
                  {d.serviceLabel}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="font-mono text-xs text-neutral-500"
                    title={d.requestId}
                  >
                    #{formatShortId(d.requestId)}
                  </span>
                </td>
                <td className="max-w-[180px] px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="line-clamp-2" title={d.reason}>
                    {d.reason}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DisputeStatusBadge status={d.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                  {fmt(d.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                  {fmt(d.resolvedAt)}
                </td>
                <td className="px-4 py-3">
                  <UpdateDisputeButton disputeId={d.id} currentStatus={d.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
