import type { Metadata } from "next"
import { Network } from "lucide-react"
// Network icon used only in empty-state and metrics area

import { requireAdmin } from "@/modules/identity/application/get-session"
import { getAdminTrustConnectionsAction } from "@/modules/trust-graph/application/actions"
import { getAdminProfessionalsForTrustGraphAction } from "@/modules/backoffice/application/actions"
import { getActivePartnersForSelectAction } from "@/modules/partners/application/actions"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { ToggleTrustConnectionButton } from "@/components/admin/ToggleTrustConnectionButton"
import { CreateTrustConnectionForm } from "@/components/admin/CreateTrustConnectionForm"
import {
  CONNECTION_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
} from "@/modules/trust-graph/domain/constants"

export const metadata: Metadata = { title: "Admin — Trust Graph" }
export const dynamic = "force-dynamic"

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(d))
}

type SearchParams = Promise<{
  sourceType?:      string
  connectionType?:  string
  status?:          string
}>

export default async function AdminTrustGraphPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin()

  const sp = await searchParams
  const filterSourceType     = sp.sourceType     || ""
  const filterConnectionType = sp.connectionType || ""
  const filterStatus         = sp.status         || ""

  const isActiveFilter =
    filterStatus === "active"   ? true  :
    filterStatus === "inactive" ? false : undefined

  const [connections, professionals, partners] = await Promise.all([
    getAdminTrustConnectionsAction({
      sourceType:     (filterSourceType as import("@/modules/trust-graph/domain/types").TrustSourceType) || undefined,
      connectionType: (filterConnectionType as import("@/modules/trust-graph/domain/types").TrustConnectionType) || undefined,
      isActive:       isActiveFilter,
    }),
    getAdminProfessionalsForTrustGraphAction(),
    getActivePartnersForSelectAction(),
  ])

  const activeCount   = connections.filter((c) => c.isActive).length
  const inactiveCount = connections.length - activeCount

  return (
    <div>
      <AdminPageHeader
        title="Trust Graph"
        description="Conexões de confiança entre origens e profissionais da rede Peteen."
      />

      {/* Métricas rápidas */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-black tabular-nums text-foreground">{connections.length}</p>
          <p className="text-xs text-muted-foreground">Total de conexões</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-black tabular-nums text-green-600 dark:text-green-400">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Conexões ativas</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-black tabular-nums text-muted-foreground">{inactiveCount}</p>
          <p className="text-xs text-muted-foreground">Conexões inativas</p>
        </div>
      </div>

      {/* Formulário de criação */}
      <div className="mb-6">
        <CreateTrustConnectionForm professionals={professionals} partners={partners} />
      </div>

      {/* Filtros */}
      <form method="GET" className="mb-4 flex flex-wrap gap-3">
        <select
          name="sourceType"
          defaultValue={filterSourceType}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Todas as origens</option>
          <option value="PARTNER">Parceiro</option>
          <option value="TUTOR">Tutor</option>
          <option value="PROFESSIONAL">Profissional</option>
        </select>

        <select
          name="connectionType"
          defaultValue={filterConnectionType}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="PARTNER_RECOMMENDS_PROFESSIONAL">Parceiro → Profissional</option>
          <option value="TUTOR_RECOMMENDS_PROFESSIONAL">Tutor → Profissional</option>
          <option value="PROFESSIONAL_RECOMMENDS_PROFESSIONAL">Prof. → Profissional</option>
        </select>

        <select
          name="status"
          defaultValue={filterStatus}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Todas</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
        </select>

        <button
          type="submit"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Filtrar
        </button>

        <a
          href="/admin/trust-graph"
          className="flex items-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Limpar
        </a>
      </form>

      {/* Tabela */}
      {connections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Network className="mx-auto mb-3 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            Nenhuma conexão de confiança encontrada.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use o formulário acima para criar a primeira conexão.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Origem</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tipo origem</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Destino</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tipo conexão</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Peso</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Criada em</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Status</th>
                <th className="sticky right-0 whitespace-nowrap bg-muted/40 px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {connections.map((conn) => (
                <tr
                  key={conn.id}
                  className={`transition-colors hover:bg-muted/20 ${
                    !conn.isActive ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{conn.sourceName}</p>
                    {conn.sourceId !== conn.sourceName.toLowerCase().replace(/\s+/g, "-") && (
                      <p className="font-mono text-[0.65rem] text-muted-foreground">{conn.sourceId}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {SOURCE_TYPE_LABELS[conn.sourceType] ?? conn.sourceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {conn.targetName}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {CONNECTION_TYPE_LABELS[conn.connectionType] ?? conn.connectionType}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-primary">+{conn.weight}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(conn.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        conn.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {conn.isActive ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="sticky right-0 bg-card px-4 py-3 text-right">
                    <ToggleTrustConnectionButton id={conn.id} isActive={conn.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
