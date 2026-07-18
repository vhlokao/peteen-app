import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { TutorStepBar } from "../_components/tutor-step-bar";
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
    <section className="overflow-hidden rounded-[44px] border border-black/5 bg-[#FAFAF8] shadow-[0_30px_60px_-24px_rgba(29,47,111,.30)]">
      <header className="bg-white px-6 pb-4 pt-5">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/onboarding" aria-label="Voltar" className="text-[#1A1A1A]">
            <ChevronLeft className="size-5" />
          </Link>
          <TutorStepBar total={2} current={1} />
          <span className="text-xs font-bold text-[#8A897F]">1/2</span>
        </div>
        <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#1A1A1A]">
          Como podemos te chamar?
        </h1>
        <p className="text-[12.5px] text-[#8A897F]">
          Só o essencial para começar.
        </p>
      </header>

      <TutorProfileForm redirectTo="/onboarding/tutor/pet" />
    </section>
  );
}
