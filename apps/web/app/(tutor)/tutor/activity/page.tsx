import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { getTutorActivityFeedAction } from "@/modules/activity-center/application/actions"
import { ActivityFeed } from "@/modules/activity-center/components/activity-feed"
import { TUTOR_ACTIVITY_EMPTY } from "@/modules/activity-center/domain/types"

export const metadata: Metadata = {
  title: "Atividades — Tutor",
}

export default async function TutorActivityPage() {
  const items = await getTutorActivityFeedAction()

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Atividades"
        description="Histórico de solicitações, avaliações e pets — somente leitura."
      />
      <ActivityFeed
        items={items}
        emptyTitle={TUTOR_ACTIVITY_EMPTY.emptyTitle}
        emptyDescription={TUTOR_ACTIVITY_EMPTY.emptyDescription}
      />
    </div>
  )
}
