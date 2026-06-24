import type { Metadata } from "next"

import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { getAdminActivityFeedAction } from "@/modules/activity-center/application/actions"
import { ActivityFeed } from "@/modules/activity-center/components/activity-feed"
import { ADMIN_ACTIVITY_EMPTY } from "@/modules/activity-center/domain/types"

export const metadata: Metadata = {
  title: "Atividades — Admin",
}

export default async function AdminActivityPage() {
  const items = await getAdminActivityFeedAction()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Central de atividades"
        description="Eventos operacionais globais — verificação, moderação e auditoria."
      />
      <ActivityFeed
        items={items}
        emptyTitle={ADMIN_ACTIVITY_EMPTY.emptyTitle}
        emptyDescription={ADMIN_ACTIVITY_EMPTY.emptyDescription}
      />
    </div>
  )
}
