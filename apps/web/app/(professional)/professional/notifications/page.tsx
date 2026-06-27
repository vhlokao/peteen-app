import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { getProfessionalNotificationsAction } from "@/modules/notifications/application/actions"
import { NotificationList } from "@/modules/notifications/components/notification-list"
import { PROFESSIONAL_NOTIFICATIONS_EMPTY } from "@/modules/notifications/domain/types"

export const metadata: Metadata = {
  title: "Notificações — Profissional",
}

export default async function ProfessionalNotificationsPage() {
  const items = await getProfessionalNotificationsAction()

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Notificações"
        description="Solicitações, avaliações e disputas que precisam da sua atenção."
      />
      <NotificationList
        items={items}
        emptyTitle={PROFESSIONAL_NOTIFICATIONS_EMPTY.emptyTitle}
        emptyDescription={PROFESSIONAL_NOTIFICATIONS_EMPTY.emptyDescription}
      />
    </div>
  )
}
