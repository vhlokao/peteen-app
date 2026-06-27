import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { getTutorNotificationsAction } from "@/modules/notifications/application/actions"
import { NotificationList } from "@/modules/notifications/components/notification-list"
import { TUTOR_NOTIFICATIONS_EMPTY } from "@/modules/notifications/domain/types"

export const metadata: Metadata = {
  title: "Notificações — Tutor",
}

export default async function TutorNotificationsPage() {
  const items = await getTutorNotificationsAction()

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Notificações"
        description="Atualizações recentes que exigem sua atenção — sem e-mail ou push."
      />
      <NotificationList
        items={items}
        emptyTitle={TUTOR_NOTIFICATIONS_EMPTY.emptyTitle}
        emptyDescription={TUTOR_NOTIFICATIONS_EMPTY.emptyDescription}
      />
    </div>
  )
}
