import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AppShell } from "@/components/layout/app-shell"
import { getPartnerNotificationCountForLayoutAction } from "@/modules/notifications/application/actions"
import { PRIVATE_AREA_METADATA } from "@/lib/seo/private-area"

/** Área privada — nunca indexada. Ver lib/seo/private-area.ts. */
export const metadata: Metadata = PRIVATE_AREA_METADATA

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
