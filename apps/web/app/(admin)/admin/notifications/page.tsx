import type { Metadata } from "next"

import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { getAdminNotificationsAction } from "@/modules/notifications/application/actions"
import { NotificationList } from "@/modules/notifications/components/notification-list"
import { ADMIN_NOTIFICATIONS_EMPTY } from "@/modules/notifications/domain/types"

export const metadata: Metadata = {
  title: "Notificações — Admin",
}

export default async function AdminNotificationsPage() {
  const items = await getAdminNotificationsAction()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Notificações"
        description="Pendências operacionais que exigem acompanhamento da equipe."
      />
      <NotificationList
        items={items}
        emptyTitle={ADMIN_NOTIFICATIONS_EMPTY.emptyTitle}
        emptyDescription={ADMIN_NOTIFICATIONS_EMPTY.emptyDescription}
      />
    </div>
  )
}
