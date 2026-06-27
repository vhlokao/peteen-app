import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlertTriangle, CheckCircle2, Info, Scale } from "lucide-react"

import type { DisputeSummary } from "../domain/types"
import { getDisputeBannerCopy } from "../domain/formatters"
import { DisputeStatusBadge } from "./dispute-status-badge"
import { cn } from "@/lib/utils"

type Props = {
  dispute: DisputeSummary
}

const TONE_STYLES = {
  attention:
    "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10",
  info: "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/10",
  success:
    "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/10",
  neutral: "border-border bg-muted/30",
} as const

const TONE_ICONS = {
  attention: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  neutral: Scale,
} as const

const TONE_ICON_COLORS = {
  attention: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
  success: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-muted-foreground",
} as const

export function DisputeBanner({ dispute }: Props) {
  const copy = getDisputeBannerCopy(dispute.status)
  const Icon = TONE_ICONS[copy.tone]

  return (
    <section className={cn("rounded-2xl border p-5", TONE_STYLES[copy.tone])}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0", TONE_ICON_COLORS[copy.tone])} />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{copy.title}</h2>
            <DisputeStatusBadge status={dispute.status} />
          </div>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Motivo reportado</dt>
              <dd className="font-medium text-foreground">{dispute.reason}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Aberta em</dt>
              <dd className="text-foreground">
                {format(dispute.createdAt, "dd MMM yyyy", { locale: ptBR })}
              </dd>
            </div>
          </dl>
          {dispute.description ? (
            <p className="rounded-lg bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              {dispute.description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
