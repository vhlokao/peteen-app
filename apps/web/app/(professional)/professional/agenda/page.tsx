import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { ProfessionalAvailabilityForm } from "@/modules/professional-availability/components/professional-availability-form"
import { getWeeklyAvailabilityForProfessional } from "@/modules/professional-availability/infrastructure/queries"

export const metadata: Metadata = {
  title: "Agenda e disponibilidade — Profissional",
}

export default async function ProfessionalAgendaPage() {
  const { profile } = await requireProfessionalContext()
  const days = await getWeeklyAvailabilityForProfessional(profile.id)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Agenda e disponibilidade"
        description="Informe os dias e horários em que você costuma atender. A disponibilidade final ainda será confirmada em cada solicitação."
      />

      <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Esta agenda é indicativa. O atendimento só é confirmado após você aceitar a
        solicitação.
      </p>

      <ProfessionalAvailabilityForm initialDays={days} />
    </div>
  )
}
