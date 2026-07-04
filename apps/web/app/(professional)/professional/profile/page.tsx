import type { Metadata } from "next"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { getProfessionalServices } from "@/modules/professional-services/infrastructure/queries"
import { getWeeklyAvailabilityForProfessional } from "@/modules/professional-availability/infrastructure/queries"
import { getProfessionalTrustSummary } from "@/modules/reputation-badges/application/get-reputation"
import { ProfessionalProfileEditForm } from "@/modules/professional/components/professional-profile-edit-form"
import { ProfessionalProfilePreview } from "@/modules/professional/components/professional-profile-preview"
import { ProfessionalProfileChecklist } from "@/modules/professional/components/professional-profile-checklist"
import { ProfessionalProfileTrustBlock } from "@/modules/professional/components/professional-profile-trust-block"

export const metadata: Metadata = {
  title: "Seu perfil profissional",
}

/**
 * /professional/profile — centro de presença pública (UX 3.8D1).
 *
 * Dados: getProfessionalServices e getWeeklyAvailabilityForProfessional
 * (já reaproveitados em Serviços/Agenda) alimentam só o checklist
 * factual — nenhum percentual inventado, cada item é um booleano real.
 * getProfessionalTrustSummary é a mesma função já usada na Home.
 */
export default async function ProfessionalProfilePage() {
  const { profile } = await requireProfessionalContext()

  const [services, availabilityDays, trustSummary] = await Promise.all([
    getProfessionalServices(profile.id),
    getWeeklyAvailabilityForProfessional(profile.id),
    getProfessionalTrustSummary(profile.id),
  ])

  const checklistItems = [
    { label: "Foto adicionada", done: Boolean(profile.avatarUrl) },
    { label: "Bio preenchida", done: Boolean(profile.bio?.trim()) },
    { label: "Cidade informada", done: Boolean(profile.city) },
    { label: "Serviço cadastrado", done: services.length > 0 },
    { label: "Disponibilidade definida", done: availabilityDays.some((d) => d.isActive) },
  ]

  return (
    <div className="page-container max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Seu perfil profissional
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuide das informações que ajudam os tutores a conhecer e confiar em você.
        </p>
      </header>

      <ProfessionalProfilePreview profile={profile} />

      <ProfessionalProfileChecklist items={checklistItems} />

      {trustSummary && (
        <ProfessionalProfileTrustBlock trustLevel={profile.trustLevel} summary={trustSummary} />
      )}

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Dados profissionais
        </h2>
        <ProfessionalProfileEditForm profile={profile} />
      </section>
    </div>
  )
}
