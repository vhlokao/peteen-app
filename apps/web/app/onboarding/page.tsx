import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, PawPrint, ShieldCheck } from "lucide-react";

import { getAuthContext } from "@/modules/identity/application/get-session";

export const metadata: Metadata = { title: "Criar conta — Escolha seu perfil" };

const NAVY = "#1D2F6F";
const CORAL = "#E07A5F";

/**
 * Página de escolha de persona.
 *
 * Guardas:
 *   - Não autenticado → /login
 *   - Já tem persona  → /dashboard (já fez onboarding)
 */
export default async function OnboardingPage() {
  const ctx = await getAuthContext();

  if (!ctx.authenticated) redirect("/login");
  if (ctx.user.primaryRole) redirect("/dashboard");

  return (
    <section
      className="relative overflow-hidden rounded-[44px] border border-black/5 shadow-[0_30px_60px_-24px_rgba(29,47,111,.4)]"
      style={{ background: NAVY }}
    >
      <span className="pointer-events-none absolute -right-[70px] -top-[90px] size-[260px] rounded-full bg-[#6EC6FF]/[.14]" />
      <span className="pointer-events-none absolute bottom-10 -left-[70px] size-[180px] rounded-full bg-[#E07A5F]/[.16]" />

      <div className="relative px-7 pb-8 pt-9">
        <span
          className="grid size-[52px] place-items-center rounded-2xl bg-white text-[26px] font-extrabold"
          style={{ color: NAVY }}
        >
          P
        </span>

        <h1 className="mt-6 text-[27px] font-extrabold leading-[1.12] tracking-[-0.025em] text-white">
          Como você quer usar o Peteen?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Escolha o perfil que melhor te descreve. Você pode ter mais de um no
          futuro.
        </p>

        <p className="mb-3 mt-8 text-[11px] font-extrabold tracking-[.06em] text-white/50">
          COMO VOCÊ QUER COMEÇAR?
        </p>

        <div className="flex flex-col gap-2.5">
          {/* Tutor — caminho primário */}
          <Link
            href="/onboarding/tutor"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left transition-transform active:scale-[.98]"
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl"
              style={{ background: "#FBEDE8", color: CORAL }}
            >
              <PawPrint className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-extrabold text-[#1A1A1A]">
                Cuidar do meu pet
              </span>
              <span className="block text-[11.5px] text-[#8A897F]">
                Sou tutor(a)
              </span>
            </span>
            <ChevronRight className="size-[18px] shrink-0" style={{ color: NAVY }} />
          </Link>

          {/* Profissional / parceiro */}
          <Link
            href="/onboarding/professional"
            className="flex items-center gap-3 rounded-2xl border border-white/[.14] bg-white/[.08] p-4 text-left transition-colors hover:bg-white/[.12]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#6EC6FF]/[.18] text-[#6EC6FF]">
              <ShieldCheck className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-extrabold text-white">
                Oferecer meus serviços
              </span>
              <span className="block text-[11.5px] text-white/60">
                Sou profissional ou parceiro
              </span>
            </span>
            <ChevronRight className="size-[18px] shrink-0 text-white/70" />
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          Você pode adicionar mais perfis depois do cadastro inicial.
        </p>
      </div>
    </section>
  );
}
