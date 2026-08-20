import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { ErrorState } from "@/components/shared/feedback/ErrorState"
import {
  getProfessionalNotificationsAction,
  getProfessionalNotificationProbeAction,
} from "@/modules/notifications/application/actions"
import { NotificationFeed } from "@/modules/notifications/components/notification-feed"
import { PROFESSIONAL_NOTIFICATIONS_EMPTY } from "@/modules/notifications/domain/types"

export const metadata: Metadata = {
  title: "Notificações — Profissional",
}

export default async function ProfessionalNotificationsPage() {
  // Ver a nota equivalente na página do tutor sobre o token inicial.
  const [items, probe] = await Promise.all([
    getProfessionalNotificationsAction(),
    getProfessionalNotificationProbeAction(),
  ])

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Notificações"
        description="Solicitações, avaliações e disputas que precisam da sua atenção."
      />
      {probe.success ? (
        <NotificationFeed
          items={items}
          role="professional"
          emptyTitle={PROFESSIONAL_NOTIFICATIONS_EMPTY.emptyTitle}
          emptyDescription={PROFESSIONAL_NOTIFICATIONS_EMPTY.emptyDescription}
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
