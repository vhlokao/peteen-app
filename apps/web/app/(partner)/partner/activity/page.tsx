import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { getPartnerActivityFeedAction } from "@/modules/activity-center/application/actions"
import { ActivityFeed } from "@/modules/activity-center/components/activity-feed"
import { PARTNER_ACTIVITY_EMPTY } from "@/modules/activity-center/domain/types"

export const metadata: Metadata = {
  title: "Atividades — Parceiro",
}

export default async function PartnerActivityPage() {
  const items = await getPartnerActivityFeedAction()

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Atividades"
        description="Recomendações, verificação e impacto na rede — somente leitura."
      />
      <ActivityFeed
        items={items}
        emptyTitle={PARTNER_ACTIVITY_EMPTY.emptyTitle}
        emptyDescription={PARTNER_ACTIVITY_EMPTY.emptyDescription}
      />
    </div>
  )
}
