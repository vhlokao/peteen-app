import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository";
import { TutorStepBar } from "../../_components/tutor-step-bar";
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

  return (
    <section className="overflow-hidden rounded-[44px] border border-black/5 bg-[#FAFAF8] shadow-[0_30px_60px_-24px_rgba(29,47,111,.30)]">
      <header className="bg-white px-6 pb-4 pt-5">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/onboarding/tutor" aria-label="Voltar" className="text-[#1A1A1A]">
            <ChevronLeft className="size-5" />
          </Link>
          <TutorStepBar total={2} current={2} />
          <span className="text-xs font-bold text-[#8A897F]">2/2</span>
        </div>
        <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#1A1A1A]">
          Quem é seu melhor amigo?
        </h1>
        <p className="text-[12.5px] text-[#8A897F]">
          Vamos conhecer seu pet. É necessário cadastrar ao menos um para continuar.
        </p>
      </header>

      <OnboardingPetForm firstName={firstName} />
    </section>
  );
}
