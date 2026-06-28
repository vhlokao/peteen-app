import type { TrustLevel } from "@/modules/professional/domain/types"
import type { PublicTrustState } from "@/modules/trust-engine/domain/public-trust-display"
import {
  PUBLIC_TRUST_BUILDING_LABEL,
  PUBLIC_TRUST_INITIAL_LABEL,
} from "@/modules/trust-engine/domain/public-trust-display"
import { cn } from "@/lib/utils"
import { TrustLevelBadge } from "./TrustLevelBadge"

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[0.65rem]",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-2.5 py-1 text-xs",
} as const

type TrustStateChipProps = {
  trustState: PublicTrustState
  trustScore?: number
  trustLevel?: TrustLevel
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

export function TrustStateChip({
  trustState,
  trustScore,
  trustLevel,
  size = "sm",
  className,
}: TrustStateChipProps) {
  const sizeClass = SIZE_CLASSES[size]
  const badgeSize = size === "sm" ? "sm" : "md"

  if (trustState === "building") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full font-medium bg-muted text-muted-foreground",
          sizeClass,
          className
        )}
      >
        {PUBLIC_TRUST_BUILDING_LABEL}
      </span>
    )
  }

  if (trustState === "initial") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full font-medium bg-info/10 text-info dark:bg-info/20",
          sizeClass,
          className
        )}
      >
        {PUBLIC_TRUST_INITIAL_LABEL}
      </span>
    )
  }

  // "score" state
  if (!trustLevel) return null

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {trustScore !== undefined && (
        <span className={cn("font-bold text-foreground tabular-nums", size === "sm" ? "text-xs" : "text-sm")}>
          {trustScore.toFixed(0)}
        </span>
      )}
      <TrustLevelBadge trustLevel={trustLevel} size={badgeSize} />
    </div>
  )
}
