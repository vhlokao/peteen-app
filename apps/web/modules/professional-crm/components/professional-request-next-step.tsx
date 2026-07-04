import { AlertTriangle, CheckCircle2, Compass, Info, Play } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { RequestStatus } from "@/modules/service-request/domain/types"
import { PROFESSIONAL_REQUEST_NOW_STEP, PROFESSIONAL_REQUEST_STATUS_TONE } from "../domain/request-status-display"

const TONE_STYLES: Record<string, { section: string; iconWrap: string; icon: LucideIcon }> = {
  pending: {
    section: "border-primary/15 bg-gradient-to-r from-primary/8 to-primary/[0.03]",
    iconWrap: "bg-primary/10 text-primary",
    icon: Compass,
  },
  info: {
    section: "border-primary/15 bg-gradient-to-r from-primary/8 to-primary/[0.03]",
    iconWrap: "bg-primary/10 text-primary",
    icon: Compass,
  },
  progress: {
    section: "border-teal-500/20 bg-teal-500/5",
    iconWrap: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    icon: Play,
  },
  success: {
    section: "border-success/20 bg-success/5",
    iconWrap: "bg-success/10 text-success",
    icon: CheckCircle2,
  },
  neutral: {
    section: "border-border/70 bg-muted/30",
    iconWrap: "bg-muted text-muted-foreground",
    icon: Info,
  },
  danger: {
    section: "border-destructive/20 bg-destructive/5",
    iconWrap: "bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
}

/**
 * "O que fazer agora" — bloco principal do detalhe (UX 3.8B). A ação em
 * si (aceitar/recusar/iniciar/concluir) continua vindo do RequestActions
 * já existente, renderizado separadamente logo abaixo deste bloco.
 */
export function ProfessionalRequestNextStep({ status }: { status: RequestStatus }) {
  const tone = PROFESSIONAL_REQUEST_STATUS_TONE[status]
  const style = TONE_STYLES[tone]!
  const Icon = style.icon

  return (
    <section className={`flex items-start gap-3 rounded-2xl border p-5 shadow-[var(--shadow-card)] ${style.section}`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          O que fazer agora
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">
          {PROFESSIONAL_REQUEST_NOW_STEP[status]}
        </p>
      </div>
    </section>
  )
}
