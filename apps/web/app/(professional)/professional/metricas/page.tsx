import type { Metadata } from "next"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { getProfessionalVerificationContext } from "@/modules/professional-crm/application/verification-context"
import {
  getProfessionalMetricsData,
  findRecentProfessionalActivity,
} from "@/modules/professional-crm/infrastructure/queries"
import { getProfessionalTrustSummary } from "@/modules/reputation-badges/application/get-reputation"
import { RequestProfessionalVerificationCard } from "@/modules/verification/components/RequestProfessionalVerificationCard"
import { ProfessionalProfileTrustBlock } from "@/modules/professional/components/professional-profile-trust-block"
import { ProfessionalMetricsOverview } from "@/modules/professional-crm/components/professional-metrics-overview"
import { ProfessionalRecurrenceCard } from "@/modules/professional-crm/components/professional-recurrence-card"
import { ProfessionalRatingSummary } from "@/modules/professional-crm/components/professional-rating-summary"
import { ProfessionalRecentActivity } from "@/modules/professional-crm/components/professional-recent-activity"
import { ProfessionalMetricsEmptyState } from "@/modules/professional-crm/components/professional-metrics-empty-state"

export const metadata: Metadata = {
  title: "Métricas",
}

/**
 * /professional/metricas — desempenho simples e acionável (UX 3.8D2).
 *
 * Dados: getProfessionalMetricsData e getProfessionalTrustSummary (já
 * reaproveitados de outras telas), findRecentProfessionalActivity (mesma
 * função da Home, limitada a 5). Nenhuma query nova, nenhum gráfico —
 * não existe série histórica real no modelo, então não foi inventada.
 * O breakdown técnico do Índice de Confiança (TrustBreakdownCard) foi
 * substituído pelo mesmo bloco humano já usado no Perfil profissional.
 */
export default async function ProfessionalMetricsPage() {
  const { profile } = await requireProfessionalContext()

  const [metrics, verification, trustSummary, recentActivity] = await Promise.all([
    getProfessionalMetricsData(profile.id, profile),
    getProfessionalVerificationContext(profile.id, profile),
    getProfessionalTrustSummary(profile.id),
    findRecentProfessionalActivity(
      profile.id,
      { isVerified: profile.isVerified, verifiedIdentity: profile.verifiedIdentity },
      5
    ),
  ])

  const { stats } = metrics
  const hasHistory = stats.completedServices > 0 || stats.reviewsReceived > 0

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Métricas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe sua atividade e as relações que você está construindo.
        </p>
      </header>

      {!hasHistory ? (
        <ProfessionalMetricsEmptyState />
      ) : (
        <div className="flex flex-col gap-5">
          <ProfessionalMetricsOverview
            completedServices={stats.completedServices}
            recurringClients={trustSummary?.recurringClientsCount ?? stats.recurringClients}
            averageRating={trustSummary?.averageRating ?? null}
            uniqueClients={stats.uniqueClients}
          />

          <ProfessionalRecurrenceCard
            recurringClients={trustSummary?.recurringClientsCount ?? stats.recurringClients}
            completedServices={stats.completedServices}
          />

          <ProfessionalRatingSummary
            averageRating={trustSummary?.averageRating ?? null}
            totalReviews={stats.reviewsReceived}
          />

          {trustSummary && (
            <ProfessionalProfileTrustBlock trustLevel={metrics.trustLevel} summary={trustSummary} />
          )}

          <ProfessionalRecentActivity items={recentActivity} />
        </div>
      )}

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Verificação de perfil</h2>
        <RequestProfessionalVerificationCard verificationStatus={verification.operationalStatus} />
      </section>
    </div>
  )
}
