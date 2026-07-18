import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository";
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
 * O cadastro do primeiro pet é obrigatório para concluir o onboarding —
 * sem ao menos um pet, o tutor não acessa o Discovery.
 * Múltiplos pets podem ser adicionados depois em /me/pets.
 *
 * OnboardingPetForm possui seu próprio header/card — esta página não
 * adiciona chrome extra (precisa trocar entre o card do formulário e o
 * card de sucesso conforme o estado local do client component).
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

  const tutorProfile = await findTutorProfileByUserId(ctx.user.id);
  const firstName = tutorProfile?.displayName.trim().split(" ")[0] ?? "";

  return <OnboardingPetForm firstName={firstName} />;
}
