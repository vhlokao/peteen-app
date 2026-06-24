import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { getProfessionalActivityFeedAction } from "@/modules/activity-center/application/actions"
import { ActivityFeed } from "@/modules/activity-center/components/activity-feed"
import { PROFESSIONAL_ACTIVITY_EMPTY } from "@/modules/activity-center/domain/types"

export const metadata: Metadata = {
  title: "Atividades — Profissional",
}

export default async function ProfessionalActivityPage() {
  const items = await getProfessionalActivityFeedAction()

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Atividades"
        description="Solicitações, reviews, recorrência e verificação — somente leitura."
      />
      <ActivityFeed
        items={items}
        emptyTitle={PROFESSIONAL_ACTIVITY_EMPTY.emptyTitle}
        emptyDescription={PROFESSIONAL_ACTIVITY_EMPTY.emptyDescription}
      />
    </div>
  )
}
