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
import { cn } from "@/lib/utils"

const SCORE_STATE_MESSAGE =
  "Este profissional constrói confiança com histórico, avaliações e recorrência na Peteen."

const NAVY_SOFT = "#2C4893"

type ProfessionalProfileTrustCardProps = {
  professionalId: string
  trustState: PublicTrustState
  trustLevel: TrustLevel
  viewerRelationshipCompletedServices?: number
  partnerEndorsements: PartnerEndorsement[]
  /**
   * "cover"  — translúcido branco sobre a capa navy (mobile, dentro do hero).
   * "card"   — card branco independente (sidebar desktop). Default.
   */
  tone?: "cover" | "card"
}

/**
 * Bloco de confiança do perfil público — nunca mostra score bruto,
 * cálculo ou percentual. TrustStateChip é chamado sem trustScore, então
 * só o nível humano (TrustLevelBadge) aparece. Texto explicativo curto
 * substitui a barra de progresso/breakdown técnico da versão anterior.
 *
 * Renderizado em dois lugares com necessidades visuais diferentes: dentro
 * da capa navy no mobile (tone="cover", texto claro) e como card
 * independente na sidebar do desktop (tone="card", texto escuro sobre
 * fundo claro) — daí a prop de tom.
 */
export function ProfessionalProfileTrustCard({
  professionalId,
  trustState,
  trustLevel,
  viewerRelationshipCompletedServices,
  partnerEndorsements,
  tone = "card",
}: ProfessionalProfileTrustCardProps) {
  const message =
    trustState === "building"
      ? PUBLIC_TRUST_BUILDING_MESSAGE
      : trustState === "initial"
        ? PUBLIC_TRUST_INITIAL_MESSAGE
        : SCORE_STATE_MESSAGE

  const isCover = tone === "cover"

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[13px]",
        isCover
          ? "bg-white/[.10] p-3.5"
          : "rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2
          className={cn(
            "text-[11px] font-extrabold uppercase tracking-[.06em]",
            isCover ? "text-white/50" : "text-muted-foreground"
          )}
        >
          Confiança
        </h2>
        <TrustStateChip trustState={trustState} trustLevel={trustLevel} size="md" />
      </div>

      <p
        className={cn(
          "text-[12.5px] leading-relaxed",
          isCover ? "font-semibold text-white/90" : "text-muted-foreground"
        )}
      >
        {message}
      </p>

      <ProfessionalReputationBadges
        professionalId={professionalId}
        viewerRelationshipCompletedServices={viewerRelationshipCompletedServices}
        max={6}
        className="mt-3"
      />

      {partnerEndorsements.length > 0 && (
        <div
          className={cn(
            "mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3",
            isCover ? "border-white/[.14]" : "border-border/70"
          )}
        >
          <ShieldCheck
            className="size-3.5 shrink-0"
            style={{ color: isCover ? "rgba(255,255,255,.7)" : NAVY_SOFT }}
            aria-hidden
          />
          <span className={cn("text-xs", isCover ? "text-white/60" : "text-muted-foreground")}>
            Recomendado por
          </span>
          <span
            className={cn("text-xs font-medium", isCover ? "text-white/90" : "")}
            style={!isCover ? { color: NAVY_SOFT } : undefined}
          >
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
