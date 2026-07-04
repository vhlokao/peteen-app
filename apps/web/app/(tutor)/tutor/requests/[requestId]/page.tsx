import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Star } from "lucide-react"

import { requireAuth } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { getServiceRequestDetailAction } from "@/modules/service-request/application/actions"
import { getReviewForRequestAction } from "@/modules/review/application/actions"
import { getMyRelationshipWithProfessional } from "@/modules/relationship/application/actions"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { SPECIES_LABELS } from "@/modules/tutor/domain/types"
import { RequestTimeline } from "@/components/requests/RequestTimeline"
import { ReviewForm } from "@/components/reviews/ReviewForm"
import { TutorRequestActions } from "@/modules/tutor-portal/components/tutor-request-actions"
import { TutorRequestStatusPill } from "@/modules/tutor-portal/components/TutorRequestStatusPill"
import { TutorRequestNextStep } from "@/modules/tutor-portal/components/TutorRequestNextStep"
import { TutorRequestSummary } from "@/modules/tutor-portal/components/TutorRequestSummary"
import { findDisputeByRequestId } from "@/modules/disputes/infrastructure/queries"
import { DisputeReportSection } from "@/modules/disputes/components/dispute-form"
import { DisputeStatusCard } from "@/modules/disputes/components/dispute-status-card"

export const metadata: Metadata = {
  title: "Detalhe da solicitação",
}

type PageProps = {
  params: Promise<{ requestId: string }>
}

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

function SubmittedReview({
  rating,
  comment,
  createdAt,
}: {
  rating: number
  comment: string | null
  createdAt: Date
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" aria-label={`${rating} de 5 estrelas`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`size-5 ${
                i < rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{formatDateShort(createdAt)}</span>
      </div>
      {comment ? <p className="text-sm leading-relaxed text-foreground">{comment}</p> : null}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-success" />
        <span>Avaliação enviada com sucesso</span>
      </div>
    </div>
  )
}

/**
 * /tutor/requests/[requestId] — Detalhe da solicitação (UX 3.7 mobile-first).
 *
 * Mesma busca de dados e mesmas regras de negócio da versão anterior
 * (canCancel/canReview/canOpenDispute inalteradas). O que mudou é só a
 * apresentação:
 *  - status pill único (TutorRequestStatusPill, mesma fonte da lista —
 *    antes havia um mapa de cores local divergente do label central)
 *  - bloco de "próximo passo" (TutorRequestNextStep) logo após o header —
 *    o elemento mais importante da tela, por pedido explícito da missão
 *  - "Profissional" e "Detalhes" (duas seções separadas antes) viraram um
 *    único card TutorRequestSummary
 *  - os banners de status condicionais (PENDING/ACCEPTED texto solto) foram
 *    removidos por ficarem redundantes com o novo bloco de próximo passo
 *
 * Nenhum WhatsApp: não existe essa regra implementada em nenhum lugar do
 * projeto hoje (confirmado por busca no código antes de implementar) —
 * não foi inventado aqui.
 */
export default async function TutorRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params
  const session = await requireAuth()
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

  const isCompleted = request.status === "COMPLETED"
  const hasReview = request.review !== null
  const canCancel = ["PENDING", "ACCEPTED"].includes(request.status)
  const canReview = isCompleted && !hasReview

  const blockedDisputeStatuses = new Set([
    "PENDING",
    "CANCELLED_BY_TUTOR",
    "CANCELLED_BY_PROFESSIONAL",
    "EXPIRED",
  ])
  const canOpenDispute = !blockedDisputeStatuses.has(request.status)

  const [existingReviewResult, myRelationship, dispute] = await Promise.all([
    isCompleted && hasReview ? getReviewForRequestAction(requestId) : null,
    getMyRelationshipWithProfessional(request.professional.id),
    findDisputeByRequestId(requestId),
  ])

  const existingReview = existingReviewResult?.success ? existingReviewResult.data : null

  const pro = request.professional

  return (
    <div className="page-container max-w-2xl pb-4">
      <Link
        href="/tutor/requests"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar aos pedidos
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pedido #{requestId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <TutorRequestStatusPill status={request.status} />
      </div>

      <div className="flex flex-col gap-5">
        <TutorRequestNextStep status={request.status} hasReview={hasReview} />

        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Acompanhamento
          </h2>
          <RequestTimeline
            request={{
              status: request.status,
              createdAt: request.createdAt,
              updatedAt: request.updatedAt,
              startedAt: request.startedAt,
              completedAt: request.completedAt,
            }}
          />
        </section>

        <TutorRequestSummary
          requestId={requestId}
          professional={{
            id: pro.id,
            displayName: pro.displayName,
            avatarUrl: pro.avatarUrl,
            city: pro.city,
          }}
          pet={request.pet}
          serviceType={request.serviceType as ServiceType}
          scheduledAtLabel={formatDate(request.scheduledAt)}
          notes={request.notes}
          isRecurring={request.isRecurring}
          myRelationship={myRelationship}
        />

        {canCancel ? (
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Ações
            </h2>
            <TutorRequestActions requestId={requestId} currentStatus={request.status} />
          </section>
        ) : null}

        {canReview && request.pet ? (
          <section className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-primary/10">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Avaliar atendimento
            </h2>
            <ReviewForm
              requestId={requestId}
              professionalName={pro.displayName}
              serviceTypeLabel={SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}
              petName={request.pet.name}
              petSpeciesLabel={SPECIES_LABELS[request.pet.species]}
            />
          </section>
        ) : null}

        {isCompleted && hasReview && existingReview ? (
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Sua avaliação
            </h2>
            <SubmittedReview
              rating={existingReview.rating}
              comment={existingReview.comment}
              createdAt={existingReview.createdAt}
            />
          </section>
        ) : null}

        {dispute ? <DisputeStatusCard dispute={dispute} /> : null}

        {!dispute && canOpenDispute ? <DisputeReportSection requestId={requestId} /> : null}
      </div>
    </div>
  )
}
