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
import { resolvePublicLocation } from "@/modules/location"

const NAVY = "#1D2F6F"

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

  const initials = partner.businessName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="page-container max-w-4xl space-y-6 pb-4">
      <section
        className="relative overflow-hidden rounded-[24px] p-5"
        style={{ background: NAVY }}
      >
        <span className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-white/[.08]" />
        <span className="pointer-events-none absolute -bottom-10 -left-8 size-28 rounded-full bg-white/[.06]" />

        <div className="relative flex items-center gap-3.5">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-lg font-extrabold"
            style={{ color: NAVY }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              Área do Parceiro
            </p>
            <p className="mt-0.5 truncate text-lg font-extrabold text-white">
              {partner.businessName}
            </p>
            <p className="mt-0.5 truncate text-xs text-white/70">
              {resolvePublicLocation({ city: partner.city, state: partner.state }).label}
            </p>
          </div>
        </div>
      </section>

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
