import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { OnboardingSteps } from "../../_components/onboarding-steps";
import { OnboardingPetForm } from "@/modules/tutor/components/pet-form";

export const metadata: Metadata = { title: "Criar conta — Adicionar Pet" };

/**
 * Página de cadastro do primeiro pet.
 *
 * Guardas:
 *   - Não autenticado → /login
 *   - Não tem TutorProfile → precisa criar o perfil primeiro
 *   - Persona diferente de TUTOR → /dashboard
 *
 * O cadastro do pet é opcional. O botão "Pular" leva para /discover.
 * Múltiplos pets podem ser adicionados depois em /me/pets.
 */
export default async function OnboardingPetPage() {
  const ctx = await getAuthContext();

  if (!ctx.authenticated) redirect("/login");

  // Sem persona → ainda não criou o TutorProfile, voltar ao passo anterior
  if (!ctx.user.primaryRole) {
    redirect("/onboarding/tutor");
  }

  // Persona diferente de TUTOR (ex: PROFESSIONAL) → já fez outro onboarding
  if (ctx.user.primaryRole !== "TUTOR") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <OnboardingSteps current={3} />

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Adicione seu primeiro pet
        </h1>
        <p className="text-sm text-muted-foreground">
          Quanto mais detalhes você fornecer, melhor os profissionais podem
          preparar o atendimento. Você pode pular e adicionar depois.
        </p>
      </div>

      <OnboardingPetForm />
    </div>
  );
}
