import { cn } from "@/lib/utils"

const STEP_LABELS = ["Pet", "Serviço", "Quando", "Revisão"] as const

type RequestFlowProgressProps = {
  /** Índice da etapa atual (0-3). A tela de sucesso não faz parte do progresso. */
  currentStep: number
}

/**
 * Indicador de progresso discreto — 4 etapas reais (Pet, Serviço, Quando,
 * Revisão). Puramente visual: não afeta validação nem navegação, só reflete
 * o estado local `step` já controlado pelo RequestServiceSheet.
 */
export function RequestFlowProgress({ currentStep }: RequestFlowProgressProps) {
  return (
    <div className="flex items-center gap-1.5 px-4" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={STEP_LABELS.length}>
      {STEP_LABELS.map((label, index) => (
        <div key={label} className="flex flex-1 flex-col gap-1">
          <div
            className={cn(
              "h-1 rounded-full transition-colors",
              index <= currentStep ? "bg-primary" : "bg-muted"
            )}
          />
          <span
            className={cn(
              "hidden text-[0.6rem] font-medium sm:block",
              index === currentStep ? "text-primary" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
