import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { OnboardingSteps } from "./_components/onboarding-steps";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Criar conta — Escolha seu perfil" };

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
    <div className="space-y-8">
      {/* Indicador de etapa */}
      <OnboardingSteps current={1} />

      {/* Cabeçalho */}
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Como você quer usar o Peteen?
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha o perfil que melhor te descreve. Você pode ter mais de um no futuro.
        </p>
      </div>

      {/* Cards de persona */}
      <div className="space-y-3">
        {/* Tutor */}
        <Link href="/onboarding/tutor">
          <PersonaCard
            emoji="🐾"
            title="Sou Tutor"
            description="Tenho pets e quero encontrar profissionais confiáveis no meu bairro."
            available
          />
        </Link>

        {/* Profissional */}
        <Link href="/onboarding/professional">
          <PersonaCard
            emoji="✂️"
            title="Sou Profissional"
            description="Ofereço serviços pet — banho, tosa, veterinária, adestramento e mais."
            available
          />
        </Link>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Você pode adicionar mais perfis depois do cadastro inicial.
      </p>
    </div>
  );
}

// ── Componentes locais ────────────────────────────────────────────────────────

function PersonaCard({
  emoji,
  title,
  description,
  available,
  comingSoon = false,
}: {
  emoji: string;
  title: string;
  description: string;
  available: boolean;
  comingSoon?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-4 rounded-xl border p-4 transition-all",
        available
          ? "cursor-pointer border-border bg-card hover:border-primary/40 hover:shadow-sm"
          : "cursor-not-allowed border-border/50 bg-muted/30 opacity-60"
      )}
    >
      {/* Ícone */}
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl">
        {emoji}
      </div>

      {/* Texto */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-heading text-sm font-semibold text-foreground">
            {title}
          </span>
          {comingSoon && (
            <Badge variant="secondary" className="text-[0.6rem]">
              Em breve
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Chevron — só para cards disponíveis */}
      {available && (
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </div>
  );
}

