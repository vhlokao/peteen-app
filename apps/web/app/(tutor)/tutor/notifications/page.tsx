import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { ErrorState } from "@/components/shared/feedback/ErrorState"
import {
  getTutorNotificationsAction,
  getTutorNotificationProbeAction,
} from "@/modules/notifications/application/actions"
import { NotificationFeed } from "@/modules/notifications/components/notification-feed"
import { TUTOR_NOTIFICATIONS_EMPTY } from "@/modules/notifications/domain/types"

export const metadata: Metadata = {
  title: "Notificações — Tutor",
}

export default async function TutorNotificationsPage() {
  // Token calculado no MESMO render que produziu `items` — o primeiro probe
  // do cliente compara contra o que a tela já mostra, nunca contra `null`
  // (mesma razão documentada no auto-sync das Requests).
  const [items, probe] = await Promise.all([
    getTutorNotificationsAction(),
    getTutorNotificationProbeAction(),
  ])

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Notificações"
        description="Atualizações recentes que exigem sua atenção."
      />
      {probe.success ? (
        <NotificationFeed
          items={items}
          role="tutor"
          emptyTitle={TUTOR_NOTIFICATIONS_EMPTY.emptyTitle}
          emptyDescription={TUTOR_NOTIFICATIONS_EMPTY.emptyDescription}
          initialToken={probe.token}
        />
      ) : (
        <ErrorState
          title="Não deu para carregar suas notificações"
          description="Algo falhou ao buscar suas atualizações. Tente novamente em alguns instantes."
        />
      )}
    </div>
  )
}
