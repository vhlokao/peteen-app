import type { Metadata } from "next"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ExternalLink, Bug } from "lucide-react"

import { getAdminProfessionalsAction } from "@/modules/backoffice/application/actions"
import { AdminDataTable } from "@/components/admin/AdminDataTable"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import { RecalculateSingleTrustButton } from "@/components/admin/RecalculateSingleTrustButton"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import type { AdminProfessionalRow } from "@/modules/backoffice/domain/types"
import type { ServiceType } from "@/modules/professional/domain/types"

export const metadata: Metadata = { title: "Admin — Profissionais" }

const COLUMNS = [
  {
    key: "name",
    header: "Nome",
    render: (row: AdminProfessionalRow) => (
      <span className="font-medium">{row.displayName}</span>
    ),
  },
  {
    key: "location",
    header: "Cidade",
    render: (row: AdminProfessionalRow) => (
      <span className="text-xs text-muted-foreground">
        {row.city}, {row.state}
      </span>
    ),
  },
  {
    key: "services",
    header: "Serviços",
    render: (row: AdminProfessionalRow) => (
      <div className="flex flex-wrap gap-1">
        {row.serviceTypes.slice(0, 2).map((s) => (
          <span
            key={s}
            className="rounded bg-muted px-1.5 py-0.5 text-[0.6rem] text-muted-foreground"
          >
            {SERVICE_TYPE_LABELS[s as ServiceType] ?? s}
          </span>
        ))}
        {row.serviceTypes.length > 2 && (
          <span className="text-[0.6rem] text-muted-foreground">
            +{row.serviceTypes.length - 2}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "trust",
    header: "Confiança",
    render: (row: AdminProfessionalRow) => (
      <div className="flex items-center gap-1.5">
        <span className="tabular-nums font-semibold">{row.trustScore.toFixed(0)}</span>
        <AdminStatusBadge type="trust" value={row.trustLevel} />
      </div>
    ),
  },
  {
    key: "reviews",
    header: "Avaliações",
    render: (row: AdminProfessionalRow) => (
      <div className="text-xs">
        <span className="tabular-nums">{row.reviewCount}</span>
        {row.averageRating != null && (
          <span className="ml-1 text-muted-foreground">
            ({row.averageRating.toFixed(1)}★)
          </span>
        )}
      </div>
    ),
  },
  {
    key: "completed",
    header: "Concluídos",
    render: (row: AdminProfessionalRow) => (
      <span className="tabular-nums text-xs">{row.completedServices}</span>
    ),
  },
  {
    key: "recurring",
    header: "Recorrentes",
    render: (row: AdminProfessionalRow) => (
      <span className="tabular-nums text-xs">{row.recurringClients}</span>
    ),
  },
  {
    key: "updatedAt",
    header: "Confiança atualizada",
    render: (row: AdminProfessionalRow) =>
      row.trustUpdatedAt ? (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.trustUpdatedAt), "dd/MM/yy HH:mm", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs text-amber-600">Nunca</span>
      ),
  },
  {
    key: "actions",
    header: "Ações",
    render: (row: AdminProfessionalRow) => (
      <div className="flex items-center gap-2">
        <Link
          href={`/discover/${row.id}`}
          target="_blank"
          className="text-muted-foreground hover:text-foreground"
          title="Ver perfil público"
        >
          <ExternalLink className="size-3.5" />
        </Link>
        <Link
          href={`/admin/trust-debug/${row.id}`}
          className="text-muted-foreground hover:text-foreground"
          title="Detalhes do índice de confiança"
        >
          <Bug className="size-3.5" />
        </Link>
        <RecalculateSingleTrustButton professionalId={row.id} />
      </div>
    ),
  },
]

export default async function AdminProfessionalsPage() {
  const professionals = await getAdminProfessionalsAction()

  return (
    <div>
      <AdminPageHeader
        title="Profissionais"
        description="Todos os profissionais cadastrados, ordenados por Índice de Confiança."
        count={professionals.length}
      />
      <AdminDataTable
        columns={COLUMNS}
        rows={professionals}
        emptyMessage="Nenhum profissional encontrado."
      />
    </div>
  )
}
