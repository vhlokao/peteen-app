import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { findProfessionalProfileByUserId } from "@/modules/professional/infrastructure/repository";
import { ProfessionalAvailabilityForm } from "@/modules/professional-availability/components/professional-availability-form";
import { getWeeklyAvailabilityForProfessional } from "@/modules/professional-availability/infrastructure/queries";
import { OnboardingSteps } from "../../_components/onboarding-steps";

export const metadata: Metadata = {
  title: "Criar conta — Disponibilidade",
};

/**
 * Passo opcional de disponibilidade no onboarding profissional.
 *
 * Guardas:
 *   - Não autenticado → /login
 *   - Sem primaryRole → /onboarding/professional
 *   - primaryRole diferente de PROFESSIONAL → /dashboard
 */
export default async function OnboardingProfessionalAvailabilityPage() {
  const ctx = await getAuthContext();

  if (!ctx.authenticated) redirect("/login");

  if (!ctx.user.primaryRole) {
    redirect("/onboarding/professional");
  }

  if (ctx.user.primaryRole !== "PROFESSIONAL") {
    redirect("/dashboard");
  }

  const profile = await findProfessionalProfileByUserId(ctx.user.id);
  if (!profile) {
    redirect("/onboarding/professional");
  }

  const days = await getWeeklyAvailabilityForProfessional(profile.id);

  return (
    <div className="space-y-8">
      <OnboardingSteps current={3} flow="professional" />

      <div className="space-y-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Quando você costuma atender?
          </h1>
          <p className="text-sm text-muted-foreground">
            Informe seus dias e horários mais comuns de atendimento. Você poderá
            alterar isso depois na sua agenda.
          </p>
        </div>

        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Essa disponibilidade é indicativa. Cada atendimento ainda será
          confirmado por você antes de acontecer.
        </p>
      </div>

      <ProfessionalAvailabilityForm
        initialDays={days}
        variant="onboarding"
        continueTo="/onboarding/professional/service"
      />
    </div>
  );
}
