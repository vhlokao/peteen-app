import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { requireAuthOrRedirect } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { getServiceRequestDetailAction } from "@/modules/service-request/application/actions"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import {
  CareTimeline,
  CareTimelineAutoRefresh,
  getCareTimelineAction,
} from "@/modules/care-timeline"

export const metadata: Metadata = {
  title: "Diário de cuidado",
}

type PageProps = {
  params: Promise<{ requestId: string }>
}

/**
 * /tutor/requests/[requestId]/diario — superfície COMPLETA da Care Timeline,
 * visão do tutor (Care Operations R0). SOMENTE LEITURA.
 *
 * Espelha os guards da Request do tutor: sessão → perfil de tutor → detalhe da
 * request → posse (`request.tutorId !== tutorProfile.id` → notFound). O guard
 * do route group valida apenas a role TUTOR, não que ESTE tutor é dono DESTA
 * request — sem a checagem explícita, qualquer tutor autenticado leria o
 * diário de um atendimento alheio.
 *
 * CareTimelineAutoRefresh reage a focus/visibilitychange (padrão já usado em
 * push-opt-in). Sem timer, sem socket, sem Realtime: a timeline continua
 * assíncrona.
 */
export default async function TutorCareDiaryPage({ params }: PageProps) {
  const { requestId } = await params
  const session = await requireAuthOrRedirect()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  const detailResult = await getServiceRequestDetailAction(requestId)

  if (!detailResult.success || !detailResult.data) {
    notFound()
  }

  const request = detailResult.data

  if (request.tutorId !== tutorProfile.id) {
    notFound()
  }

  // Mesma regra da visão do profissional: o diário só existe do início do
  // atendimento em diante.
  if (!["IN_PROGRESS", "COMPLETED"].includes(request.status)) {
    notFound()
  }

  const careTimelineResult = await getCareTimelineAction(requestId)
  if (!careTimelineResult.success) {
    notFound()
  }
  const careUpdates = careTimelineResult.data

  return (
    <div className="page-container max-w-2xl pb-4">
      <CareTimelineAutoRefresh />

      <div className="mb-5 flex items-center gap-3">
        <Link
          href={`/tutor/requests/${requestId}`}
          aria-label="Voltar para a solicitação"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground">Diário de cuidado</h1>
          <p className="truncate text-xs text-muted-foreground">
            {SERVICE_TYPE_LABELS[request.serviceType as ServiceType]} · #
            {requestId.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Histórico do atendimento
        </h2>
        <CareTimeline updates={careUpdates} />
      </section>
    </div>
  )
}
