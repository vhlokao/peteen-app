import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { OnboardingSteps } from "../_components/onboarding-steps";
import { TutorProfileForm } from "@/modules/tutor/components/tutor-profile-form";

export const metadata: Metadata = { title: "Criar conta — Perfil de Tutor" };

/**
 * Página de criação do TutorProfile.
 *
 * Guardas:
 *   - Não autenticado → /login
 *   - Já tem TutorProfile (TUTOR) → pular para o passo do pet
 *   - Sem onboarding geral → redirecionar para /onboarding
 */
export default async function OnboardingTutorPage() {
  const ctx = await getAuthContext();

  if (!ctx.authenticated) redirect("/login");

  // Já completou onboarding como tutor → pular direto para pet
  if (ctx.user.primaryRole === "TUTOR") {
    redirect("/onboarding/tutor/pet");
  }

  // Tem outra persona → já fez onboarding, vai para área principal
  if (ctx.user.primaryRole !== null) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <OnboardingSteps current={2} />

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Crie seu perfil de tutor
        </h1>
        <p className="text-sm text-muted-foreground">
          Suas informações ajudam profissionais locais a te conhecer antes do primeiro contato.
        </p>
      </div>

      <TutorProfileForm redirectTo="/onboarding/tutor/pet" />
    </div>
  );
}
