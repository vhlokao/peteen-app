import type { ReactNode } from "react"

import { AppShell } from "@/components/layout/app-shell"
import { getPartnerNotificationCountForLayoutAction } from "@/modules/notifications/application/actions"

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const notificationCount = await getPartnerNotificationCountForLayoutAction()

  return (
    <AppShell
      variant="partner"
      notificationCount={notificationCount}
      notificationsHref="/partner/notifications"
    >
      {children}
    </AppShell>
  )
}
