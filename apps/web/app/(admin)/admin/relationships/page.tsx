import type { Metadata } from "next"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminRelationshipsAction } from "@/modules/backoffice/application/actions"
import { AdminDataTable } from "@/components/admin/AdminDataTable"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import type { AdminRelationshipRow } from "@/modules/backoffice/domain/types"

export const metadata: Metadata = { title: "Admin — Relacionamentos" }

type RelPageProps = {
  searchParams: Promise<{ relationshipLevel?: string }>
}

const COLUMNS = [
  {
    key: "tutor",
    header: "Tutor",
    render: (row: AdminRelationshipRow) => (
      <span className="text-xs">{row.tutorName}</span>
    ),
  },
  {
    key: "professional",
    header: "Profissional",
    render: (row: AdminRelationshipRow) => (
      <span className="text-xs font-medium">{row.professionalName}</span>
    ),
  },
  {
    key: "level",
    header: "Nível",
    render: (row: AdminRelationshipRow) => (
      <AdminStatusBadge type="relationship" value={row.relationshipLevel} />
    ),
  },
  {
    key: "completed",
    header: "Concluídos",
    render: (row: AdminRelationshipRow) => (
      <span className="tabular-nums font-semibold">{row.completedServices}</span>
    ),
  },
  {
    key: "total",
    header: "Solicitações",
    render: (row: AdminRelationshipRow) => (
      <span className="tabular-nums text-xs text-muted-foreground">{row.totalRequests}</span>
    ),
  },
  {
    key: "reviews",
    header: "Avaliações",
    render: (row: AdminRelationshipRow) => (
      <span className="tabular-nums text-xs">{row.reviewsGiven}</span>
    ),
  },
  {
    key: "score",
    header: "Rel. Score",
    render: (row: AdminRelationshipRow) => (
      <span className="tabular-nums text-xs">{row.relationshipScore.toFixed(1)}</span>
    ),
  },
  {
    key: "firstService",
    header: "Primeiro",
    render: (row: AdminRelationshipRow) =>
      row.firstServiceAt ? (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.firstServiceAt), "dd/MM/yy", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "lastService",
    header: "Último",
    render: (row: AdminRelationshipRow) =>
      row.lastServiceAt ? (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.lastServiceAt), "dd/MM/yy", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
]

const LEVEL_OPTIONS = [
  { value: "",          label: "Todos os níveis" },
  { value: "NEW",       label: "Novo" },
  { value: "KNOWN",     label: "Conhecido" },
  { value: "RECURRING", label: "Recorrente" },
  { value: "TRUSTED",   label: "Confiável" },
  { value: "PARTNER",   label: "Parceiro" },
]

export default async function AdminRelationshipsPage({ searchParams }: RelPageProps) {
  const { relationshipLevel } = await searchParams
  const rows = await getAdminRelationshipsAction({ relationshipLevel })

  return (
    <div>
      <AdminPageHeader
        title="Relacionamentos"
        description="Vínculos entre tutores e profissionais, ordenados por atendimentos concluídos."
        count={rows.length}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-3">
        <select
          name="relationshipLevel"
          defaultValue={relationshipLevel ?? ""}
          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrar
        </button>
        {relationshipLevel && (
          <a
            href="/admin/relationships"
            className="py-1.5 text-sm text-muted-foreground underline"
          >
            Limpar
          </a>
        )}
      </form>

      <AdminDataTable
        columns={COLUMNS}
        rows={rows}
        emptyMessage="Nenhum relacionamento encontrado."
      />
    </div>
  )
}
