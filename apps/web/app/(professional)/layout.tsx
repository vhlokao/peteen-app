import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getProfessionalNotificationCountForLayoutAction } from "@/modules/notifications/application/actions";

export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  const notificationCount = await getProfessionalNotificationCountForLayoutAction();

  return (
    <AppShell
      variant="professional"
      notificationCount={notificationCount}
      notificationsHref="/professional/notifications"
    >
      {children}
    </AppShell>
  );
}
