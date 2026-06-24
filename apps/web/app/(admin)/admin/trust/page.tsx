import type { Metadata } from "next"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Bug } from "lucide-react"

import { getAdminTrustDataAction } from "@/modules/backoffice/application/actions"
import { AdminDataTable } from "@/components/admin/AdminDataTable"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import { RecalculateAllTrustButton } from "@/components/admin/RecalculateAllTrustButton"
import { RecalculateSingleTrustButton } from "@/components/admin/RecalculateSingleTrustButton"
import type { AdminTrustRow } from "@/modules/backoffice/domain/types"

export const metadata: Metadata = { title: "Admin — Índice de Confiança" }

const COLUMNS = [
  {
    key: "name",
    header: "Profissional",
    render: (row: AdminTrustRow) => (
      <span className="font-medium">{row.displayName}</span>
    ),
  },
  {
    key: "city",
    header: "Cidade",
    render: (row: AdminTrustRow) => (
      <span className="text-xs text-muted-foreground">{row.city}</span>
    ),
  },
  {
    key: "score",
    header: "Índice de Confiança",
    render: (row: AdminTrustRow) => (
      <span className="tabular-nums font-bold">{row.trustScore.toFixed(1)}</span>
    ),
  },
  {
    key: "level",
    header: "Nível",
    render: (row: AdminTrustRow) => (
      <AdminStatusBadge type="trust" value={row.trustLevel} />
    ),
  },
  {
    key: "reviews",
    header: "Avaliações",
    render: (row: AdminTrustRow) => (
      <span className="tabular-nums text-xs">{row.reviewCount}</span>
    ),
  },
  {
    key: "completed",
    header: "Concluídos",
    render: (row: AdminTrustRow) => (
      <span className="tabular-nums text-xs">{row.completedServices}</span>
    ),
  },
  {
    key: "updatedAt",
    header: "Última atualização",
    render: (row: AdminTrustRow) =>
      row.trustUpdatedAt ? (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.trustUpdatedAt), "dd/MM/yy HH:mm", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs font-medium text-amber-600">Nunca recalculado</span>
      ),
  },
  {
    key: "actions",
    header: "Ações",
    render: (row: AdminTrustRow) => (
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/trust-debug/${row.id}`}
          className="text-muted-foreground hover:text-foreground"
          title="Ver detalhes do índice de confiança"
        >
          <Bug className="size-3.5" />
        </Link>
        <RecalculateSingleTrustButton professionalId={row.id} />
      </div>
    ),
  },
]

export default async function AdminTrustPage() {
  const rows = await getAdminTrustDataAction()
  const staleCount = rows.filter((r) => !r.trustUpdatedAt).length

  return (
    <div>
      <AdminPageHeader
        title="Índice de Confiança"
        description="Índice de Confiança e nível de todos os profissionais."
        count={rows.length}
        actions={<RecalculateAllTrustButton />}
      />

      {staleCount > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-400">
          <strong>{staleCount}</strong> profissional(is) nunca tiveram o Índice de Confiança calculado.
          Use o botão &ldquo;Recalcular todos&rdquo; para atualizar.
        </div>
      )}

      <AdminDataTable
        columns={COLUMNS}
        rows={rows}
        emptyMessage="Nenhum profissional encontrado."
      />
    </div>
  )
}
