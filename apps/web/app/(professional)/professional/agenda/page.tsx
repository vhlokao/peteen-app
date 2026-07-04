import type { Metadata } from "next"
import { CalendarClock } from "lucide-react"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { getMyRequestsAsProfessionalAction } from "@/modules/service-request/application/actions"
import { getWeeklyAvailabilityForProfessional } from "@/modules/professional-availability/infrastructure/queries"
import { ProfessionalAvailabilityForm } from "@/modules/professional-availability/components/professional-availability-form"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { classifyAgendaBucket, groupRequestsByAgendaBucket } from "@/modules/professional-crm/domain/agenda-grouping"
import { ProfessionalTodaySummary } from "@/modules/professional-crm/components/professional-today-summary"
import { ProfessionalAgendaGroup } from "@/modules/professional-crm/components/professional-agenda-group"
import { ProfessionalAgendaInProgress } from "@/modules/professional-crm/components/professional-agenda-in-progress"

export const metadata: Metadata = {
  title: "Agenda",
}

/**
 * /professional/agenda — compromissos reais (UX 3.8C mobile-first).
 *
 * Fonte dos compromissos: getMyRequestsAsProfessionalAction (a mesma
 * action já usada em /requests e na Home), filtrada para ACCEPTED/
 * IN_PROGRESS — os únicos estados que representam um atendimento
 * confirmado. PENDING não entra (ainda não é compromisso) e COMPLETED
 * também não (a agenda atual nunca mostrou histórico, então esta missão
 * não adiciona isso agora).
 *
 * A disponibilidade semanal (feature real já existente) continua
 * disponível abaixo, sem nenhuma alteração de lógica — só mudou de
 * posição, virando conteúdo secundário da tela.
 */
export default async function ProfessionalAgendaPage() {
  const { profile } = await requireProfessionalContext()

  const [requestsResult, availabilityDays] = await Promise.all([
    getMyRequestsAsProfessionalAction({ limit: 50 }),
    getWeeklyAvailabilityForProfessional(profile.id),
  ])

  const requests = requestsResult.success ? requestsResult.data : []
  const inProgress = requests.filter((r) => r.status === "IN_PROGRESS")
  const accepted = requests.filter((r) => r.status === "ACCEPTED")
  const active = [...inProgress, ...accepted]

  const todayCount = active.filter((r) => classifyAgendaBucket(r.scheduledAt) === "today").length
  const groups = groupRequestsByAgendaBucket(accepted)

  const hasAnyAppointment = active.length > 0

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja seus próximos cuidados e compromissos.
        </p>
      </header>

      {!hasAnyAppointment ? (
        <EmptyState
          icon={<CalendarClock className="size-7" />}
          title="Agenda livre por enquanto"
          description="Novos atendimentos aceitos aparecerão aqui."
          action={{ label: "Ver solicitações", href: "/requests" }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {inProgress.map((request) => (
            <ProfessionalAgendaInProgress key={request.id} request={request} />
          ))}

          <ProfessionalTodaySummary count={todayCount} />

          {groups.map((group) => (
            <ProfessionalAgendaGroup key={group.bucket} label={group.label} requests={group.requests} />
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Disponibilidade semanal</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Esta agenda é indicativa. O atendimento só é confirmado após você aceitar a solicitação.
        </p>
        <ProfessionalAvailabilityForm initialDays={availabilityDays} />
      </section>
    </div>
  )
}
