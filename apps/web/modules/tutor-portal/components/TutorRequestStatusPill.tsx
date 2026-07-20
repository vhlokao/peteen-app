import type { RequestStatus } from "@/modules/service-request/domain/types"
import { REQUEST_STATUS_META, REQUEST_STATUS_COLORS } from "../domain/request-status-display"
import { cn } from "@/lib/utils"

type TutorRequestStatusPillProps = {
  status: RequestStatus
  size?: "sm" | "md"
  className?: string
}

export function TutorRequestStatusPill({
  status,
  size = "md",
  className,
}: TutorRequestStatusPillProps) {
  const meta = REQUEST_STATUS_META[status]
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
      {meta.label}
    </span>
  )
}
