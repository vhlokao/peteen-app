import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Star } from "lucide-react"

import { getAuthContext } from "@/modules/identity/application/get-session"
import { getServiceRequestDetailAction } from "@/modules/service-request/application/actions"
import { findRelationship } from "@/modules/relationship/infrastructure/repository"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { RequestTimeline } from "@/components/requests/RequestTimeline"
import { RequestActions } from "@/components/requests/RequestActions"
import { findDisputeForProfessionalRequest } from "@/modules/disputes/infrastructure/queries"
import { DisputeBanner } from "@/modules/disputes/components/dispute-banner"
import { ProfessionalRequestStatusPill } from "@/modules/professional-crm/components/professional-request-status-pill"
import { ProfessionalRequestNextStep } from "@/modules/professional-crm/components/professional-request-next-step"
import { ProfessionalRequestSummary } from "@/modules/professional-crm/components/professional-request-summary"

export const metadata: Metadata = {
  title: "Detalhe da solicitação",
}

type DetailPageProps = {
  params: Promise<{ id: string }>
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

/**
 * /requests/[id] — detalhe da solicitação, perspectiva do profissional
 * (UX 3.8B mobile-first).
 *
 * Rota compartilhada com o tutor no arquivo original, mas o tutor é
 * redirecionado para /tutor/requests/[id] antes de qualquer render aqui
 * (já era assim antes desta missão) — por isso o corpo da página, na
 * prática, só precisa servir a visão do profissional.
 *
 * Dados, guards e ações de negócio (getServiceRequestDetailAction,
 * RequestActions, disputa) são exatamente os mesmos de antes — só a
 * apresentação mudou.
 */
export default async function RequestDetailPage({ params }: DetailPageProps) {
  const { id } = await params

  const [ctx, detailResult] = await Promise.all([
    getAuthContext(),
    getServiceRequestDetailAction(id),
  ])

  if (!detailResult.success || !detailResult.data) {
    notFound()
  }

  const request = detailResult.data
  const isTutorView = ctx.authenticated && ctx.user.primaryRole === "TUTOR"

  if (isTutorView) {
    redirect(`/tutor/requests/${id}`)
  }

  const isProfessionalView = ctx.authenticated && ctx.user.primaryRole === "PROFESSIONAL"

  const isActionable =
    isProfessionalView && ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(request.status)

  const [dispute, priorRelationship] = await Promise.all([
    isProfessionalView
      ? findDisputeForProfessionalRequest(id, request.professional.id)
      : Promise.resolve(null),
    isProfessionalView
      ? findRelationship(request.tutor.id, request.professional.id)
      : Promise.resolve(null),
  ])

  return (
    <div className="page-container max-w-2xl pb-4">
      <Link
        href="/requests"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar às solicitações
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Solicitação #{id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <ProfessionalRequestStatusPill status={request.status} />
      </div>

      <div className="flex flex-col gap-5">
        {isProfessionalView && <ProfessionalRequestNextStep status={request.status} />}

        {isProfessionalView && isActionable && (
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Ações
            </h2>
            <RequestActions
              requestId={id}
              currentStatus={request.status}
              scheduledAt={request.scheduledAt}
            />
          </section>
        )}

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

        <ProfessionalRequestSummary
          tutor={request.tutor}
          pet={request.pet}
          serviceType={request.serviceType as ServiceType}
          scheduledAtLabel={formatDate(request.scheduledAt)}
          notes={request.notes}
          isRecurring={request.isRecurring}
          priorRelationship={priorRelationship}
        />

        {isProfessionalView && request.status === "COMPLETED" && request.review && (
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Avaliação recebida
            </h2>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1" aria-label={`${request.review.rating} de 5 estrelas`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${
                      i < request.review!.rating
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <Link href="/professional/reviews" className="text-xs font-medium text-primary hover:underline">
                Ver todas as avaliações →
              </Link>
            </div>
          </section>
        )}

        {isProfessionalView && dispute ? <DisputeBanner dispute={dispute} /> : null}
      </div>
    </div>
  )
}
