import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { OnboardingSteps } from "../../_components/onboarding-steps";
import { ServiceForm } from "@/modules/professional/components/service-form";

export const metadata: Metadata = { title: "Criar conta — Primeiro Serviço" };

/**
 * Página de cadastro do primeiro serviço.
 *
 * Guardas:
 *   - Não autenticado → /login
 *   - Sem primaryRole (pulou etapa) → /onboarding/professional
 *   - primaryRole diferente de PROFESSIONAL → /dashboard
 */
export default async function OnboardingProfessionalServicePage() {
  const ctx = await getAuthContext();

  if (!ctx.authenticated) redirect("/login");

  if (!ctx.user.primaryRole) {
    redirect("/onboarding/professional");
  }

  if (ctx.user.primaryRole !== "PROFESSIONAL") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <OnboardingSteps current={4} flow="professional" />

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Cadastre seu primeiro serviço
        </h1>
        <p className="text-sm text-muted-foreground">
          Tutores vão encontrar você pelos serviços que você oferece. Você pode adicionar mais depois.
        </p>
      </div>

      <ServiceForm redirectTo="/requests" skipTo="/requests" />
    </div>
  );
}
