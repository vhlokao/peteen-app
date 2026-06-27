import { notFound } from "next/navigation"
import { format }   from "date-fns"
import { ptBR }     from "date-fns/locale"

import { devListActiveRequestsAction }  from "@/modules/service-request/application/dev-actions"
import type { DevActiveRequest }        from "@/modules/service-request/infrastructure/repository"
import { AdminPageHeader }              from "@/components/admin/AdminPageHeader"
import {
  DevCancelButton,
  DevExpireButton,
  DevClearPairButton,
} from "@/components/admin/DevRequestActionButton"

/**
 * /admin/dev-tools — página de controles de desenvolvimento e testes.
 *
 * PRODUÇÃO: retorna notFound() — não existe para usuários finais.
 * DEVELOPMENT: lista solicitações ativas e permite limpeza controlada.
 *
 * Acesso: apenas admins autenticados (garantido pelo AdminShell do layout).
 * Server Actions: protegidas por NODE_ENV + requireAdmin() em dev-actions.ts.
 */
export default async function AdminDevToolsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound()
  }

  const result = await devListActiveRequestsAction()
  const rows: DevActiveRequest[] = result.success ? result.data : []

  const fmt = (d: Date | null) =>
    d ? format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"

  const STATUS_COLOR: Record<string, string> = {
    PENDING:     "bg-yellow-100 text-yellow-800",
    ACCEPTED:    "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-orange-100 text-orange-800",
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dev Tools — Solicitações Ativas"
        description="Somente em desenvolvimento. Permite visualizar e limpar solicitações presas que bloqueiam testes dos guardrails."
      />

      {/* Banner de aviso */}
      <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
        <strong>⚠ AMBIENTE DE DESENVOLVIMENTO</strong> — Estas ações bypassam a máquina de estados e não geram TrustEvents.
        Não replicam comportamento de produção. Use apenas para destravar testes manuais.
      </div>

      {/* Referência das flags de bypass */}
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-1">
        <p className="font-semibold">Flags de bypass via .env.local (não commitáveis):</p>
        <p><code>DEV_BYPASS_OPERATIONAL_GUARDRAILS=true</code> — desliga: duplicata ativa, IN_PROGRESS block (aceite/início)</p>
        <p><code>DEV_BYPASS_ANTIFRAUD_GUARDRAILS=true</code> — desliga: bloqueio de 24h início/conclusão</p>
        <p className="text-amber-700 mt-1">Em production, essas flags são ignoradas por código — não por disciplina.</p>
      </div>

      {/* Tabela de solicitações ativas */}
      {rows.length === 0 ? (
        <div className="rounded border border-neutral-200 bg-white px-6 py-8 text-center text-sm text-neutral-500">
          Nenhuma solicitação ativa no momento. Os guardrails não estão bloqueando nada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Tutor</th>
                <th className="px-3 py-2">Profissional</th>
                <th className="px-3 py-2">Criado</th>
                <th className="px-3 py-2">Agendado</th>
                <th className="px-3 py-2">Ações (DEV)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                    {r.id.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                        STATUS_COLOR[r.status] ?? "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{r.serviceType}</td>
                  <td className="px-3 py-2 font-medium">{r.tutorName}</td>
                  <td className="px-3 py-2 font-medium">{r.professionalName}</td>
                  <td className="px-3 py-2 text-neutral-500 text-xs">{fmt(r.createdAt)}</td>
                  <td className="px-3 py-2 text-neutral-500 text-xs">{fmt(r.scheduledAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <DevCancelButton requestId={r.id} status={r.status} />
                      <DevExpireButton requestId={r.id} status={r.status} />
                      <DevClearPairButton
                        tutorId={r.tutorId}
                        professionalId={r.professionalId}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-400">
            Mostrando até 200 registros. Total ativo: {rows.length}.
          </p>
        </div>
      )}
    </div>
  )
}
