import { getProfessionalReputationBadges } from "../application/get-reputation"
import { ReputationBadgePill } from "./reputation-badge-pill"
import type { ReputationBadge } from "../domain/types"

type ProfessionalReputationBadgesProps = {
  professionalId: string
  /** Pré-carregado em batch (Discovery) — evita N+1 */
  badges?: ReputationBadge[]
  max?: number
  /** Visão tutor: completedServices do relacionamento pessoal */
  viewerRelationshipCompletedServices?: number
  className?: string
}

export async function ProfessionalReputationBadges({
  professionalId,
  badges: preloaded,
  max = 4,
  viewerRelationshipCompletedServices,
  className,
}: ProfessionalReputationBadgesProps) {
  const badges =
    preloaded ??
    (await getProfessionalReputationBadges(professionalId, {
      max,
      viewerRelationshipCompletedServices,
    }))

  if (badges.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {badges.map((badge) => (
        <ReputationBadgePill key={badge.type} badge={badge} />
      ))}
    </div>
  )
}
