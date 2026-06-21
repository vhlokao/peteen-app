import type { ReputationBadge } from "../domain/types"
import { ReputationBadgePill } from "./reputation-badge-pill"

/** Presentacional — sem imports server/Prisma (seguro para cards e client boundaries). */
export function ReputationBadgeList({
  badges,
  className,
}: {
  badges: ReputationBadge[]
  className?: string
}) {
  if (!badges || badges.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {badges.map((badge) => (
        <ReputationBadgePill key={badge.type} badge={badge} />
      ))}
    </div>
  )
}
