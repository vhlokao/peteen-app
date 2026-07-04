import type { Metadata } from "next"

import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import {
  getPartnerDashboardStats,
  findRecentPartnerActivity,
} from "@/modules/partner-portal/infrastructure/queries"
import { PartnerAttentionCard } from "@/modules/partner-portal/components/partner-attention-card"
import { PartnerQuickActions } from "@/modules/partner-portal/components/partner-quick-actions"
import { PartnerSummary } from "@/modules/partner-portal/components/partner-summary"
import { PartnerImpactCard } from "@/modules/partner-portal/components/partner-impact-card"
import { PartnerRecentActivity } from "@/modules/partner-portal/components/partner-recent-activity"

export const metadata: Metadata = {
  title: "Portal do parceiro",
}

/**
 * /partner — hub leve de acompanhamento (UX 3.9).
 *
 * Ordem: atenção agora -> resumo -> ações rápidas -> impacto -> atividade.
 * Não existe fluxo de "recomendação pendente de análise" no modelo — o
 * sinal real de atenção é o status de verificação da organização
 * (verificado antes de implementar, ver domain/status-display.ts).
 */
export default async function PartnerHomePage() {
  const { partner } = await requirePartnerContext()

  const [stats, recentActivity] = await Promise.all([
    getPartnerDashboardStats(partner.id, partner.verificationStatus),
    findRecentPartnerActivity(partner.id, partner.slug, 5),
  ])

  const firstName = partner.businessName.split(" ")[0] || partner.businessName

  return (
    <div className="page-container max-w-4xl space-y-6 pb-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Olá, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe suas recomendações e ajude a fortalecer a rede.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        <PartnerAttentionCard verificationStatus={stats.verificationStatus} />

        <PartnerSummary stats={stats} />

        <PartnerQuickActions />

        <PartnerImpactCard
          activeRecommendations={stats.activeRecommendations}
          verifiedRecommended={stats.verifiedRecommended}
        />

        <PartnerRecentActivity items={recentActivity} />
      </div>
    </div>
  )
}
