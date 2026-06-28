import type { TrustLevel } from "@/modules/professional/domain/types"
import { TRUST_LEVEL_LABELS } from "@/modules/professional/domain/types"
import { cn } from "@/lib/utils"

export const TRUST_LEVEL_COLORS: Record<TrustLevel, string> = {
  INITIAL:     "bg-muted text-muted-foreground",
  BUILDING:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ESTABLISHED: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  TRUSTED:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ELITE:       "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

type TrustLevelBadgeProps = {
  trustLevel: TrustLevel
  size?: "sm" | "md"
  className?: string
}

export function TrustLevelBadge({ trustLevel, size = "sm", className }: TrustLevelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm"
          ? "px-2 py-0.5 text-[0.65rem]"
          : "px-2.5 py-0.5 text-xs",
        TRUST_LEVEL_COLORS[trustLevel],
        className
      )}
    >
      {TRUST_LEVEL_LABELS[trustLevel]}
    </span>
  )
}
