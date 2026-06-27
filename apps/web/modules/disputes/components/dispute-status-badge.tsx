import type { DisputeStatus } from "../domain/types"
import { DISPUTE_STATUS_COLORS, formatDisputeStatusLabel } from "../domain/formatters"
import { cn } from "@/lib/utils"

type Props = {
  status: DisputeStatus
  className?: string
}

export function DisputeStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        DISPUTE_STATUS_COLORS[status],
        className
      )}
    >
      {formatDisputeStatusLabel(status)}
    </span>
  )
}
