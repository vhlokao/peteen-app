import type { Metadata } from "next"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminTutorsAction } from "@/modules/backoffice/application/actions"
import { AdminDataTable } from "@/components/admin/AdminDataTable"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import type { AdminTutorRow } from "@/modules/backoffice/domain/types"

export const metadata: Metadata = { title: "Admin — Tutores" }

const COLUMNS = [
  {
    key: "name",
    header: "Nome",
    render: (row: AdminTutorRow) => (
      <span className="font-medium">{row.displayName}</span>
    ),
  },
  {
    key: "location",
    header: "Localização",
    render: (row: AdminTutorRow) => (
      <span className="text-xs text-muted-foreground">
        {row.city}, {row.state}
      </span>
    ),
  },
  {
    key: "pets",
    header: "Pets",
    render: (row: AdminTutorRow) => (
      <span className="tabular-nums">{row.petCount}</span>
    ),
  },
  {
    key: "requests",
    header: "Solicitações",
    render: (row: AdminTutorRow) => (
      <span className="tabular-nums">{row.requestCount}</span>
    ),
  },
  {
    key: "reviews",
    header: "Avaliações enviadas",
    render: (row: AdminTutorRow) => (
      <span className="tabular-nums">{row.reviewCount}</span>
    ),
  },
  {
    key: "createdAt",
    header: "Cadastrado em",
    render: (row: AdminTutorRow) => (
      <span className="text-xs text-muted-foreground">
        {format(new Date(row.createdAt), "dd/MM/yyyy", { locale: ptBR })}
      </span>
    ),
  },
]

export default async function AdminTutorsPage() {
  const tutors = await getAdminTutorsAction()

  return (
    <div>
      <AdminPageHeader
        title="Tutores"
        description="Todos os tutores cadastrados no Peteen."
        count={tutors.length}
      />
      <AdminDataTable
        columns={COLUMNS}
        rows={tutors}
        emptyMessage="Nenhum tutor encontrado."
      />
    </div>
  )
}
