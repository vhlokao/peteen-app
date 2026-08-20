import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Star } from "lucide-react"

import { getAuthContext } from "@/modules/identity/application/get-session"
import { getServiceRequestDetailAction } from "@/modules/service-request/application/actions"
import { findRequestAcceptedAt } from "@/modules/service-request/infrastructure/audit"
import { findRelationship } from "@/modules/relationship/infrastructure/repository"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { formatScheduledCivilDate } from "@/lib/date/zoned-datetime"
import { RequestTimeline } from "@/components/requests/RequestTimeline"
import { RequestActions } from "@/components/requests/RequestActions"
import { findDisputeForProfessionalRequest } from "@/modules/disputes/infrastructure/queries"
import { DisputeBanner } from "@/modules/disputes/components/dispute-banner"
import { ContextualPushSection } from "@/modules/notifications/components/contextual-push-section"
import { ProfessionalRequestStatusPill } from "@/modules/professional-crm/components/professional-request-status-pill"
import { ProfessionalRequestNextStep } from "@/modules/professional-crm/components/professional-request-next-step"
import { ProfessionalRequestSummary } from "@/modules/professional-crm/components/professional-request-summary"
import { CareTimelineSummary, getCareTimelineAction } from "@/modules/care-timeline"
import { ActiveRequestAutoRefresh } from "@/modules/service-request/components/ActiveRequestAutoRefresh"
import {
  buildRequestSyncToken,
  REQUEST_OPERATIONAL_POLL_INTERVAL_MS,
} from "@/modules/service-request/domain/active-request-sync"
import { getRequestSyncSnapshot } from "@/modules/service-request/infrastructure/sync-snapshot"

export const metadata: Metadata = {
  title: "Detalhe da solicitação",
}

type DetailPageProps = {
  params: Promise<{ id: string }>
}

function formatDate(date: Date | null, scheduledHasTime: boolean): string {
  if (!date) return "—"
  // Fuso pela precisão: date-only legado em UTC (recupera o dia gravado),
  // horário real no fuso do piloto. Ver scheduledDayTimeZone.
  return formatScheduledCivilDate(new Date(date), scheduledHasTime, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
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

  // acceptedAt — horário real do aceite (AuditLog), para a timeline exibir o
  // instante exato em vez de updatedAt (que muda em toda transição
  // posterior). Só relevante a partir de ACCEPTED; em PENDING nunca houve
  // aceite, então não vale a query.
  const needsAcceptedAt = request.status !== "PENDING"

  const [dispute, priorRelationship, acceptedAt, syncSnapshot] = await Promise.all([
    isProfessionalView
      ? findDisputeForProfessionalRequest(id, request.professional.id)
      : Promise.resolve(null),
    isProfessionalView
      ? findRelationship(request.tutor.id, request.professional.id)
      : Promise.resolve(null),
    needsAcceptedAt ? findRequestAcceptedAt(id) : Promise.resolve(null),
    // Token inicial do auto-sync (R2B.2 hardening) — ver comentário
    // equivalente na página do tutor.
    getRequestSyncSnapshot(id),
  ])
  const initialSyncToken = syncSnapshot ? buildRequestSyncToken(syncSnapshot) : null

  // Care Timeline — a Request mostra apenas um RESUMO (Care Operations R0). A
  // leitura completa e a publicação vivem em /requests/[id]/diario: inline e
  // sem teto, a timeline crescia indefinidamente no meio da página.
  const showCareTimeline =
    isProfessionalView && ["IN_PROGRESS", "COMPLETED"].includes(request.status)
  const careTimelineResult = showCareTimeline ? await getCareTimelineAction(id) : null
  const careUpdates = careTimelineResult?.success ? careTimelineResult.data : []

  return (
    // Auto-sync (R2B.2): decisão explícita de incluir o profissional também —
    // não é cópia automática do lado do tutor. A request pode mudar por ação
    // ALHEIA enquanto esta tela está aberta: o tutor pode cancelar (PENDING/
    // ACCEPTED) e uma disputa pode ser aberta (ACCEPTED/IN_PROGRESS) — nenhum
    // dos dois é iniciado pelo próprio profissional, então nenhum
    // router.refresh() próprio cobriria essas mudanças.
    <ActiveRequestAutoRefresh
      requestId={id}
      status={request.status}
      initialToken={initialSyncToken}
      pollIntervalMs={REQUEST_OPERATIONAL_POLL_INTERVAL_MS}
    >
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
        {isProfessionalView && (
          <ProfessionalRequestNextStep status={request.status} hasActions={isActionable} />
        )}

        {isProfessionalView && isActionable && (
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Ações
            </h2>
            <RequestActions
              requestId={id}
              currentStatus={request.status}
              scheduledAt={request.scheduledAt}
              scheduledHasTime={request.scheduledHasTime}
            />
          </section>
        )}

        {/* Diário antes das etapas: durante o atendimento é onde o profissional
            trabalha. As etapas são referência de contrato, não tarefa. */}
        {showCareTimeline && (
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Diário de cuidado
            </h2>
            {/* Rótulo contextual (R2B.4): durante o atendimento a ação
                recorrente do profissional é REGISTRAR, não ler — "Abrir diário"
                descreve leitura e escondia a tarefa. Concluído, volta a ser
                consulta.

                Deliberadamente NÃO é um segundo botão: o card de próximo passo
                não tem CTA por decisão de R2B.1, e duplicar o caminho para o
                diário criaria dois botões para o mesmo destino. A hierarquia
                fica: "Atualizar diário" (recorrente, aqui) vs. "Concluir
                atendimento" (terminal, no card de Ações acima). */}
            <CareTimelineSummary
              updates={careUpdates}
              diaryHref={`/requests/${id}/diario`}
              ctaLabel={request.status === "IN_PROGRESS" ? "Atualizar diário" : "Abrir diário"}
            />
          </section>
        )}

        {/* Convite contextual de notificações (R2B.5) — mesmo princípio da
            página do tutor: depois do bloco operacional (próximo passo →
            Ações → Diário) e antes do material de consulta (etapas, resumo).

            Fica DEPOIS de "Ações" de propósito: nunca entre um botão crítico
            (aceitar/iniciar/concluir) e a confirmação que ele exige. E depois
            do Diário porque, durante o atendimento, é ali que o profissional
            trabalha — a promessa de aviso faz sentido ao lado do trabalho,
            não no rodapé. */}
        {isProfessionalView ? (
          <ContextualPushSection
            persona="professional"
            requestId={id}
            status={request.status}
          />
        ) : null}

        {/* "Acompanhamento" → "Etapas do atendimento": este bloco mostra marcos
            do contrato, não o conteúdo do cuidado. Ver a nota equivalente na
            página do tutor. */}
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Etapas do atendimento
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

        <ProfessionalRequestSummary
          tutor={request.tutor}
          pet={request.pet}
          serviceType={request.serviceType as ServiceType}
          scheduledAtLabel={formatDate(request.scheduledAt, request.scheduledHasTime)}
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
    </ActiveRequestAutoRefresh>
  )
}
