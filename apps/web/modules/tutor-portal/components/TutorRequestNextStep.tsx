import { CheckCircle2, Compass } from "lucide-react"

import type { RequestStatus } from "@/modules/service-request/domain/types"
import { REQUEST_STATUS_META, REQUEST_STATUS_COLORS } from "../domain/request-status-display"

const GREEN = "#40916C"

type TutorRequestNextStepProps = {
  status: RequestStatus
  /** true quando já existe uma review enviada para esta solicitação. */
  hasReview: boolean
}

/**
 * Bloco de "próximo passo" — o elemento mais importante do detalhe
 * (pedido explícito da missão). Usa só o texto humano já mapeado em
 * REQUEST_STATUS_META; nenhuma ação nova é sugerida aqui. Cores reaproveitam
 * REQUEST_STATUS_COLORS (mesma fonte do pill de status).
 */
export function TutorRequestNextStep({ status, hasReview }: TutorRequestNextStepProps) {
  if (status === "COMPLETED" && hasReview) {
    return (
      <section
        className="flex items-start gap-3 rounded-2xl border p-5 shadow-[var(--shadow-card)]"
        style={{ borderColor: `${GREEN}33`, background: `${GREEN}0D` }}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${GREEN}22`, color: GREEN }}
        >
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

  const colors = REQUEST_STATUS_COLORS[status]

  return (
    <section
      className="flex items-start gap-3 rounded-2xl border p-5 shadow-[var(--shadow-card)]"
      style={{ borderColor: `${colors.fg}33`, background: colors.bg }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "#fff", color: colors.fg }}
      >
        <Compass className="size-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: colors.fg }}>
          Próximo passo
        </p>
        <p className="mt-0.5 text-sm font-medium" style={{ color: "#1A1A1A" }}>
          {meta.nextStep}
        </p>
      </div>
    </section>
  )
}
