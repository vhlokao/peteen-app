import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getProfessionalNotificationCountForLayoutAction } from "@/modules/notifications/application/actions";
import { getAuthContext } from "@/modules/identity/application/get-session";
import {
  findProfessionalProfileByUserId,
  countActivePricedServicesByProfessionalId,
} from "@/modules/professional/infrastructure/repository";

export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  // Gate de conclusão do onboarding: sem ao menos um serviço ativo com preço,
  // o profissional volta ao passo de serviço. O passo vive em /onboarding
  // (fora deste grupo), então não há loop de redirect.
  const ctx = await getAuthContext();
  if (ctx.authenticated && ctx.user.primaryRole === "PROFESSIONAL") {
    const profile = await findProfessionalProfileByUserId(ctx.user.id);
    if (profile) {
      const pricedServices = await countActivePricedServicesByProfessionalId(
        profile.id
      );
      if (pricedServices === 0) {
        redirect("/onboarding/professional/service");
      }
    }
  }

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
