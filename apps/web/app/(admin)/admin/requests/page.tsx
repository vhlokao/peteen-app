import type { Metadata } from "next"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminRequestsAction } from "@/modules/backoffice/application/actions"
import { AdminDataTable } from "@/components/admin/AdminDataTable"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import type { AdminRequestRow } from "@/modules/backoffice/domain/types"
import type { ServiceType } from "@/modules/professional/domain/types"

export const metadata: Metadata = { title: "Admin — Solicitações" }

type RequestsPageProps = {
  searchParams: Promise<{ status?: string; serviceType?: string }>
}

const COLUMNS = [
  {
    key: "id",
    header: "ID",
    render: (row: AdminRequestRow) => (
      <span className="font-mono text-[0.65rem] text-muted-foreground">
        {row.id.slice(0, 8)}…
      </span>
    ),
  },
  {
    key: "tutor",
    header: "Tutor",
    render: (row: AdminRequestRow) => (
      <span className="text-xs">{row.tutorName}</span>
    ),
  },
  {
    key: "professional",
    header: "Profissional",
    render: (row: AdminRequestRow) => (
      <span className="text-xs">{row.professionalName}</span>
    ),
  },
  {
    key: "pet",
    header: "Pet",
    render: (row: AdminRequestRow) => (
      <span className="text-xs text-muted-foreground">{row.petName}</span>
    ),
  },
  {
    key: "serviceType",
    header: "Serviço",
    render: (row: AdminRequestRow) => (
      <span className="text-xs">
        {SERVICE_TYPE_LABELS[row.serviceType as ServiceType] ?? row.serviceType}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row: AdminRequestRow) => (
      <AdminStatusBadge type="request" value={row.status} />
    ),
  },
  {
    key: "scheduledAt",
    header: "Agendado",
    render: (row: AdminRequestRow) =>
      row.scheduledAt ? (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.scheduledAt), "dd/MM/yy", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "createdAt",
    header: "Criado em",
    render: (row: AdminRequestRow) => (
      <span className="text-xs text-muted-foreground">
        {format(new Date(row.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
      </span>
    ),
  },
  {
    key: "completedAt",
    header: "Concluído",
    render: (row: AdminRequestRow) =>
      row.completedAt ? (
        <span className="text-xs text-emerald-600">
          {format(new Date(row.completedAt), "dd/MM/yy", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
]

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "PENDING",                   label: "Pendente" },
  { value: "ACCEPTED",                  label: "Aceito" },
  { value: "IN_PROGRESS",               label: "Em andamento" },
  { value: "COMPLETED",                 label: "Concluído" },
  { value: "CANCELLED_BY_TUTOR",        label: "Cancelado (tutor)" },
  { value: "CANCELLED_BY_PROFESSIONAL", label: "Cancelado (pro)" },
  { value: "DISPUTED",                  label: "Disputado" },
]

export default async function AdminRequestsPage({ searchParams }: RequestsPageProps) {
  const { status, serviceType } = await searchParams
  const requests = await getAdminRequestsAction({ status, serviceType })

  return (
    <div>
      <AdminPageHeader
        title="Solicitações"
        description="Histórico completo de solicitações de serviço."
        count={requests.length}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((o) => (
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
        {status && (
          <a href="/admin/requests" className="py-1.5 text-sm text-muted-foreground underline">
            Limpar
          </a>
        )}
      </form>

      <AdminDataTable
        columns={COLUMNS}
        rows={requests}
        emptyMessage="Nenhuma solicitação encontrada."
      />
    </div>
  )
}
