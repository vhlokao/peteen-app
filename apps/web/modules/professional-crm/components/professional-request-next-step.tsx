import { AlertTriangle, CheckCircle2, Compass, Info, Play } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { RequestStatus } from "@/modules/service-request/domain/types"
import { PROFESSIONAL_REQUEST_NOW_STEP } from "../domain/request-status-display"
import { REQUEST_STATUS_COLORS } from "@/modules/tutor-portal/domain/request-status-display"

const STATUS_ICON: Record<RequestStatus, LucideIcon> = {
  PENDING: Compass,
  ACCEPTED: Compass,
  IN_PROGRESS: Play,
  COMPLETED: CheckCircle2,
  CANCELLED_BY_TUTOR: Info,
  CANCELLED_BY_PROFESSIONAL: Info,
  DISPUTED: AlertTriangle,
  EXPIRED: Info,
}

/**
 * "O que fazer agora" — bloco principal do detalhe (UX 3.8B). A ação em
 * si (aceitar/recusar/iniciar/concluir) continua vindo do RequestActions
 * já existente, renderizado separadamente logo abaixo deste bloco. Cores
 * reaproveitam REQUEST_STATUS_COLORS — mesmo padrão visual do
 * TutorRequestNextStep.
 */
export function ProfessionalRequestNextStep({ status }: { status: RequestStatus }) {
  const colors = REQUEST_STATUS_COLORS[status]
  const Icon = STATUS_ICON[status]

  return (
    <section
      className="flex items-start gap-3 rounded-2xl border p-5 shadow-[var(--shadow-card)]"
      style={{ borderColor: `${colors.fg}33`, background: colors.bg }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "#fff", color: colors.fg }}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: colors.fg }}>
          O que fazer agora
        </p>
        <p className="mt-0.5 text-sm font-medium" style={{ color: "#1A1A1A" }}>
          {PROFESSIONAL_REQUEST_NOW_STEP[status]}
        </p>
      </div>
    </section>
  )
}
