import { cn } from "@/lib/utils";

type OnboardingStepsProps = {
  /** Etapa atual (1-indexed) */
  current: number;
  /** Fluxo de onboarding — define labels e quantidade de etapas */
  flow?: "tutor" | "professional";
};

const TUTOR_STEPS = [
  { label: "Perfil" },
  { label: "Cadastro" },
  { label: "Pet" },
] as const;

const PROFESSIONAL_STEPS = [
  { label: "Perfil" },
  { label: "Cadastro" },
  { label: "Horários" },
  { label: "Serviço" },
] as const;

/**
 * Indicador de progresso para o fluxo de onboarding.
 * Exibe etapas com estado: concluída, ativa ou pendente.
 */
export function OnboardingSteps({ current, flow = "tutor" }: OnboardingStepsProps) {
  const steps = flow === "professional" ? PROFESSIONAL_STEPS : TUTOR_STEPS;

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;

        return (
          <div key={step.label} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[0.65rem] font-semibold transition-colors",
                  isActive && "bg-primary text-primary-foreground",
                  isDone && "bg-primary/20 text-primary",
                  !isActive && !isDone && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? "✓" : stepNum}
              </div>
              <span
                className={cn(
                  "text-[0.55rem] font-medium uppercase tracking-wide",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "mb-4 h-px w-8 shrink-0",
                  stepNum < current ? "bg-primary/40" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
