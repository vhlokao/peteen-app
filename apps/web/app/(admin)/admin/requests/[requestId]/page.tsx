import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { requireAdminOrRedirect } from "@/modules/identity/application/get-session"
import { findServiceRequestWithParticipants } from "@/modules/service-request/infrastructure/repository"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import { getAdminCareTimelineInspectionAction } from "@/modules/care-timeline/application/admin-actions"
import { AdminCareTimelineInspection } from "@/modules/care-timeline/components/AdminCareTimelineInspection"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ requestId: string }>
}

function formatDateTime(date: Date | null): string {
  if (!date) return "—"
  return format(new Date(date), "dd/MM/yy HH:mm", { locale: ptBR })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { requestId } = await params
  return { title: `Solicitação #${requestId.slice(0, 8)} — Admin` }
}

/**
 * /admin/requests/[requestId] — detalhe administrativo de uma solicitação.
 *
 * requireAdminOrRedirect() é chamado aqui diretamente, sem depender só do
 * AdminShell (layout) — defesa em profundidade, mesmo padrão de
 * admin/partners/[id]. A variante *OrRedirect redireciona em vez de lançar,
 * para não gerar stack trace de fluxo esperado.
 *
 * V0: mostra os dados essenciais da solicitação + a inspeção da Care
 * Timeline (histórico completo, incluindo itens editados/excluídos).
 * Somente leitura — nenhuma ação administrativa nesta tela ainda.
 */
export default async function AdminRequestDetailPage({ params }: Props) {
  await requireAdminOrRedirect()

  const { requestId } = await params
  const request = await findServiceRequestWithParticipants(requestId)

  if (!request) notFound()

  const inspectionResult = await getAdminCareTimelineInspectionAction(requestId)
  const inspection = inspectionResult.success
    ? inspectionResult.data
    : { requestId, items: [] }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/requests"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar para solicitações
      </Link>

      <AdminPageHeader
        title={`Solicitação #${requestId.slice(0, 8)}`}
        description="Detalhe administrativo — dados essenciais e histórico do atendimento."
      />

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            {SERVICE_TYPE_LABELS[request.serviceType as ServiceType] ?? request.serviceType}
          </h2>
          <AdminStatusBadge type="request" value={request.status} />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Tutor</dt>
            <dd className="text-foreground">{request.tutor.displayName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Profissional</dt>
            <dd className="text-foreground">{request.professional.displayName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pet</dt>
            <dd className="text-foreground">{request.pet?.name ?? "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Agendado para</dt>
            <dd className="text-foreground">{formatDateTime(request.scheduledAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Iniciado em</dt>
            <dd className="text-foreground">{formatDateTime(request.startedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Concluído em</dt>
            <dd className="text-foreground">{formatDateTime(request.completedAt)}</dd>
          </div>
        </dl>
      </section>

      {!inspectionResult.success ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          {inspectionResult.error}
        </section>
      ) : (
        <AdminCareTimelineInspection inspection={inspection} />
      )}
    </div>
  )
}
