import { CheckCircle2, Compass } from "lucide-react"

import type { RequestStatus } from "@/modules/service-request/domain/types"
import { REQUEST_STATUS_META } from "../domain/request-status-display"

type TutorRequestNextStepProps = {
  status: RequestStatus
  /** true quando já existe uma review enviada para esta solicitação. */
  hasReview: boolean
}

/**
 * Bloco de "próximo passo" — o elemento mais importante do detalhe
 * (pedido explícito da missão). Usa só o texto humano já mapeado em
 * REQUEST_STATUS_META; nenhuma ação nova é sugerida aqui.
 */
export function TutorRequestNextStep({ status, hasReview }: TutorRequestNextStepProps) {
  if (status === "COMPLETED" && hasReview) {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-success/20 bg-success/5 p-5 shadow-[var(--shadow-card)]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tudo certo
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            Você já avaliou este atendimento. Obrigado pelo retorno!
          </p>
        </div>
      </section>
    )
  }

  const meta = REQUEST_STATUS_META[status]
  if (!meta.nextStep) return null

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/8 to-primary/[0.03] p-5 shadow-[var(--shadow-card)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Compass className="size-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Próximo passo
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{meta.nextStep}</p>
      </div>
    </section>
  )
}
