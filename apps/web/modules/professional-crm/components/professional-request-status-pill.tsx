import type { RequestStatus } from "@/modules/service-request/domain/types"
import { cn } from "@/lib/utils"
import {
  PROFESSIONAL_REQUEST_STATUS_LABELS,
  PROFESSIONAL_REQUEST_STATUS_TONE,
  PROFESSIONAL_REQUEST_STATUS_TONE_CLASS,
} from "../domain/request-status-display"

type ProfessionalRequestStatusPillProps = {
  status: RequestStatus
  size?: "sm" | "md"
  className?: string
}

export function ProfessionalRequestStatusPill({
  status,
  size = "md",
  className,
}: ProfessionalRequestStatusPillProps) {
  const tone = PROFESSIONAL_REQUEST_STATUS_TONE[status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-[0.65rem]" : "px-3 py-1 text-xs",
        PROFESSIONAL_REQUEST_STATUS_TONE_CLASS[tone],
        className
      )}
    >
      {PROFESSIONAL_REQUEST_STATUS_LABELS[status]}
    </span>
  )
}
