import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { OnboardingSteps } from "../_components/onboarding-steps";
import { ProfessionalProfileForm } from "@/modules/professional/components/professional-profile-form";

export const metadata: Metadata = { title: "Criar conta — Perfil de Profissional" };

/**
 * Página de criação do ProfessionalProfile.
 *
 * Guardas:
 *   - Não autenticado → /login
 *   - Já tem ProfessionalProfile (PROFESSIONAL) → pular para primeiro serviço
 *   - Tem outra persona ativa → /dashboard (já fez onboarding)
 */
export default async function OnboardingProfessionalPage() {
  const ctx = await getAuthContext();

  if (!ctx.authenticated) redirect("/login");

  if (ctx.user.primaryRole === "PROFESSIONAL") {
    redirect("/onboarding/professional/service");
  }

  if (ctx.user.primaryRole !== null) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <OnboardingSteps current={2} />

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Crie seu perfil de profissional
        </h1>
        <p className="text-sm text-muted-foreground">
          Tutores verão estas informações ao escolher um profissional no bairro deles.
        </p>
      </div>

      <ProfessionalProfileForm redirectTo="/onboarding/professional/service" />
    </div>
  );
}
