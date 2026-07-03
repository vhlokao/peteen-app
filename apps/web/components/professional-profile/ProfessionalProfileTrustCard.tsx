import { ShieldCheck } from "lucide-react"

import { TrustStateChip } from "@/components/shared/trust/TrustStateChip"
import { ProfessionalReputationBadges } from "@/modules/reputation-badges/components/professional-reputation-badges"
import {
  PUBLIC_TRUST_BUILDING_MESSAGE,
  PUBLIC_TRUST_INITIAL_MESSAGE,
  type PublicTrustState,
} from "@/modules/trust-engine/domain/public-trust-display"
import type { TrustLevel } from "@/modules/professional/domain/types"
import type { PartnerEndorsement } from "@/modules/partners/domain/types"

const SCORE_STATE_MESSAGE =
  "Este profissional constrói confiança com histórico, avaliações e recorrência na Peteen."

type ProfessionalProfileTrustCardProps = {
  professionalId: string
  trustState: PublicTrustState
  trustLevel: TrustLevel
  viewerRelationshipCompletedServices?: number
  partnerEndorsements: PartnerEndorsement[]
}

/**
 * Bloco de confiança do perfil público — nunca mostra score bruto,
 * cálculo ou percentual. TrustStateChip é chamado sem trustScore, então
 * só o nível humano (TrustLevelBadge) aparece. Texto explicativo curto
 * substitui a barra de progresso/breakdown técnico da versão anterior.
 */
export function ProfessionalProfileTrustCard({
  professionalId,
  trustState,
  trustLevel,
  viewerRelationshipCompletedServices,
  partnerEndorsements,
}: ProfessionalProfileTrustCardProps) {
  const message =
    trustState === "building"
      ? PUBLIC_TRUST_BUILDING_MESSAGE
      : trustState === "initial"
        ? PUBLIC_TRUST_INITIAL_MESSAGE
        : SCORE_STATE_MESSAGE

  return (
    <section className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Confiança
        </h2>
        <TrustStateChip trustState={trustState} trustLevel={trustLevel} size="md" />
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>

      <ProfessionalReputationBadges
        professionalId={professionalId}
        viewerRelationshipCompletedServices={viewerRelationshipCompletedServices}
        max={6}
        className="mt-3"
      />

      {partnerEndorsements.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="text-xs text-muted-foreground">Recomendado por</span>
          <span className="text-xs font-medium text-primary">
            {partnerEndorsements
              .slice(0, 3)
              .map((p) => p.name)
              .join(", ")}
            {partnerEndorsements.length > 3 && ` +${partnerEndorsements.length - 3}`}
          </span>
        </div>
      )}
    </section>
  )
}
