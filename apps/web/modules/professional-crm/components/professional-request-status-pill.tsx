import type { RequestStatus } from "@/modules/service-request/domain/types"
import { cn } from "@/lib/utils"
import { PROFESSIONAL_REQUEST_STATUS_LABELS } from "../domain/request-status-display"
import { REQUEST_STATUS_COLORS } from "@/modules/tutor-portal/domain/request-status-display"

type ProfessionalRequestStatusPillProps = {
  status: RequestStatus
  size?: "sm" | "md"
  className?: string
}

/**
 * Mesma paleta de cores do TutorRequestStatusPill (REQUEST_STATUS_COLORS,
 * fonte única) — só o texto muda (PROFESSIONAL_REQUEST_STATUS_LABELS,
 * redação na perspectiva do profissional).
 */
export function ProfessionalRequestStatusPill({
  status,
  size = "md",
  className,
}: ProfessionalRequestStatusPillProps) {
  const colors = REQUEST_STATUS_COLORS[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-[0.65rem]" : "px-3 py-1 text-xs",
        className
      )}
      style={{ background: colors.bg, color: colors.fg }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: colors.dot }} />
      {PROFESSIONAL_REQUEST_STATUS_LABELS[status]}
    </span>
  )
}
