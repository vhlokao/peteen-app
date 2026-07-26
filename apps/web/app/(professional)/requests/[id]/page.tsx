import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Star } from "lucide-react"

import { getAuthContext } from "@/modules/identity/application/get-session"
import { getServiceRequestDetailAction } from "@/modules/service-request/application/actions"
import { findCooldownReleaseAt } from "@/modules/service-request/infrastructure/repository"
import { findRequestAcceptedAt } from "@/modules/service-request/infrastructure/audit"
import { ANTIFRAUD_GUARDRAILS } from "@/modules/antifraude/domain/constants"
import { findRelationship } from "@/modules/relationship/infrastructure/repository"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { RequestTimeline } from "@/components/requests/RequestTimeline"
import { RequestActions } from "@/components/requests/RequestActions"
import { findDisputeForProfessionalRequest } from "@/modules/disputes/infrastructure/queries"
import { DisputeBanner } from "@/modules/disputes/components/dispute-banner"
import { ProfessionalRequestStatusPill } from "@/modules/professional-crm/components/professional-request-status-pill"
import { ProfessionalRequestNextStep } from "@/modules/professional-crm/components/professional-request-next-step"
import { ProfessionalRequestSummary } from "@/modules/professional-crm/components/professional-request-summary"
import { CareUpdateForm, CareTimeline, getCareTimelineAction } from "@/modules/care-timeline"

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

  // cooldownReleaseAt — view model específico desta página (só profissional,
  // só quando o botão "Aceitar" existe/importa). Não entra no DTO
  // compartilhado com o tutor (getServiceRequestDetailAction).
  const needsCooldownCheck = isProfessionalView && request.status === "PENDING"

  // acceptedAt — horário real do aceite (AuditLog), para a timeline exibir o
  // instante exato em vez de updatedAt (que muda em toda transição
  // posterior). Só relevante a partir de ACCEPTED; em PENDING nunca houve
  // aceite, então não vale a query.
  const needsAcceptedAt = request.status !== "PENDING"

  const [dispute, priorRelationship, cooldownReleaseAt, acceptedAt] = await Promise.all([
    isProfessionalView
      ? findDisputeForProfessionalRequest(id, request.professional.id)
      : Promise.resolve(null),
    isProfessionalView
      ? findRelationship(request.tutor.id, request.professional.id)
      : Promise.resolve(null),
    needsCooldownCheck
      ? findCooldownReleaseAt(
          request.tutor.id,
          request.professional.id,
          ANTIFRAUD_GUARDRAILS.MIN_HOURS_BETWEEN_COMPLETIONS_SAME_PAIR
        )
      : Promise.resolve(null),
    needsAcceptedAt ? findRequestAcceptedAt(id) : Promise.resolve(null),
  ])

  // Care Timeline — durante o atendimento (com publicação) e após concluído
  // (só leitura). V0. Uma disputa aberta congela a publicação (o servidor já
  // bloqueia; aqui escondemos o form para o profissional não bater no erro),
  // mas a leitura da timeline é preservada.
  const hasActiveDispute = dispute?.status === "OPEN" || dispute?.status === "UNDER_REVIEW"
  const showCareTimeline =
    isProfessionalView && ["IN_PROGRESS", "COMPLETED"].includes(request.status)
  const canPublishCare =
    isProfessionalView && request.status === "IN_PROGRESS" && !hasActiveDispute
  const careTimelineResult = showCareTimeline ? await getCareTimelineAction(id) : null
  const careUpdates = careTimelineResult?.success ? careTimelineResult.data : []

  return (
    <div className="page-container max-w-2xl pb-4">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/requests"
          aria-label="Voltar"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold text-foreground">Solicitação</h1>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}
          </h2>
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
              cooldownReleaseAt={cooldownReleaseAt}
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
              acceptedAt,
            }}
          />
        </section>

        {showCareTimeline && (
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Diário de cuidado
            </h2>
            {canPublishCare ? (
              <>
                <p className="mb-4 text-xs text-muted-foreground">
                  Compartilhe como está sendo o atendimento. O tutor acompanha em tempo real.
                </p>
                <CareUpdateForm requestId={id} />
                <div className="mt-5">
                  <CareTimeline updates={careUpdates} />
                </div>
              </>
            ) : (
              <div className="mt-3">
                <CareTimeline updates={careUpdates} />
              </div>
            )}
          </section>
        )}

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
