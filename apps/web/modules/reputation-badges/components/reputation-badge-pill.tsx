import type { ReputationBadge } from "../domain/types"
import { REPUTATION_BADGE_META } from "../domain/constants"

type ReputationBadgePillProps = {
  badge: ReputationBadge
  size?: "xs" | "sm"
}

export function ReputationBadgePill({
  badge,
  size = "xs",
}: ReputationBadgePillProps) {
  const meta = REPUTATION_BADGE_META[badge.type]
  const sizeClass =
    size === "xs"
      ? "px-2 py-0.5 text-[0.65rem]"
      : "px-2.5 py-1 text-xs"

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${meta.className} ${sizeClass}`}
      title={badge.description}
      aria-label={`${badge.label} — ${badge.description}`}
    >
      {badge.type === "verified" && <span className="mr-0.5" aria-hidden="true">✓</span>}
      {badge.label}
    </span>
  )
}
