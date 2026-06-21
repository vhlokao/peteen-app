import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { getProfessionalPortalData } from "@/modules/professional-crm/infrastructure/queries"
import { ProfessionalStatsGrid } from "@/modules/professional-crm/components/professional-stats-grid"
import { ProfessionalRecentActivity } from "@/modules/professional-crm/components/professional-recent-activity"
import { ProfessionalNextActions } from "@/modules/professional-crm/components/professional-next-actions"
import { ProfessionalTrustSummary } from "@/modules/reputation-badges/components/professional-trust-summary"

export const metadata: Metadata = {
  title: "Portal do profissional",
}

export default async function ProfessionalDashboardPage() {
  const { profile } = await requireProfessionalContext()
  const portal = await getProfessionalPortalData(profile.id, profile.trustScore, profile)

  return (
    <div className="page-container space-y-8">
      <PageHeader
        title={`Olá, ${profile.displayName.split(" ")[0]}`}
        description="Painel operacional — clientes, solicitações e evolução reputacional."
        action={
          <Link href="/requests" className={buttonVariants({ size: "sm" })}>
            Ver solicitações
          </Link>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reputação
        </h2>
        <ProfessionalTrustSummary professionalId={profile.id} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Resumo
        </h2>
        <ProfessionalStatsGrid stats={portal.stats} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfessionalNextActions actions={portal.nextActions} />
        <ProfessionalRecentActivity items={portal.recentActivity} />
      </div>
    </div>
  )
}
