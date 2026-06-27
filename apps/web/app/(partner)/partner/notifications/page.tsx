import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { getPartnerNotificationsAction } from "@/modules/notifications/application/actions"
import { NotificationList } from "@/modules/notifications/components/notification-list"
import { PARTNER_NOTIFICATIONS_EMPTY } from "@/modules/notifications/domain/types"

export const metadata: Metadata = {
  title: "Notificações — Parceiro",
}

export default async function PartnerNotificationsPage() {
  const items = await getPartnerNotificationsAction()

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Notificações"
        description="Atividade da sua rede de profissionais recomendados."
      />
      <NotificationList
        items={items}
        emptyTitle={PARTNER_NOTIFICATIONS_EMPTY.emptyTitle}
        emptyDescription={PARTNER_NOTIFICATIONS_EMPTY.emptyDescription}
      />
    </div>
  )
}
