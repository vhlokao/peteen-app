import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { buildPartnerPublicUrl } from "@/modules/partner-portal/domain/navigation"
import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { getPartnerPortalData } from "@/modules/partner-portal/infrastructure/queries"
import { PartnerStatsGrid } from "@/modules/partner-portal/components/partner-stats-grid"
import { PartnerRecentActivity } from "@/modules/partner-portal/components/partner-recent-activity"
import { PartnerNextActions } from "@/modules/partner-portal/components/partner-next-actions"

export const metadata: Metadata = {
  title: "Portal do parceiro",
}

export default async function PartnerDashboardPage() {
  const { partner } = await requirePartnerContext()
  const portal = await getPartnerPortalData(partner)

  return (
    <div className="page-container space-y-8">
      <PageHeader
        title={`Olá, ${partner.businessName.split(" ")[0]}`}
        description="Painel operacional — recomendações, conexões e impacto na rede."
        action={
          <Link
            href={buildPartnerPublicUrl(partner.slug, "/partner")}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver perfil público
          </Link>
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Resumo
        </h2>
        <PartnerStatsGrid stats={portal.stats} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <PartnerNextActions actions={portal.nextActions} />
        <PartnerRecentActivity items={portal.recentActivity} />
      </div>
    </div>
  )
}
