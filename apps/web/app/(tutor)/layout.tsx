import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getTutorNotificationCountForLayoutAction } from "@/modules/notifications/application/actions";

export default async function TutorLayout({ children }: { children: ReactNode }) {
  const notificationCount = await getTutorNotificationCountForLayoutAction();

  return (
    <AppShell
      variant="tutor"
      notificationCount={notificationCount}
      notificationsHref="/tutor/notifications"
    >
      {children}
    </AppShell>
  );
}
