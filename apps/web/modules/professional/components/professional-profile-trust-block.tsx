import { ShieldCheck, Sparkles } from "lucide-react"

import { TRUST_LEVEL_LABELS, type TrustLevel } from "@/modules/professional/domain/types"
import type { ReputationTrustSummary } from "@/modules/reputation-badges/domain/types"
import { ReputationBadgePill } from "@/modules/reputation-badges/components/reputation-badge-pill"

const TRUST_LEVEL_CONTEXT: Record<TrustLevel, string> = {
  INITIAL: "Sua confiança está em construção. Conclua atendimentos e receba avaliações para evoluir.",
  BUILDING: "Você já está construindo uma reputação sólida na rede.",
  ESTABLISHED: "Seu perfil já é reconhecido como confiável pelos tutores.",
  TRUSTED: "Você está entre os profissionais de destaque da rede.",
  ELITE: "Você alcançou o nível mais alto de confiança da rede Peteen.",
}

type ProfessionalProfileTrustBlockProps = {
  trustLevel: TrustLevel
  summary: ReputationTrustSummary
}

/**
 * Confiança em linguagem humana — nível + explicação curta + badges reais
 * separados em Verificações e Conquistas. Nenhuma fórmula, peso ou
 * breakdown técnico. O índice numérico, se aparecer, vem sempre junto do
 * nível, nunca isolado.
 */
export function ProfessionalProfileTrustBlock({
  trustLevel,
  summary,
}: ProfessionalProfileTrustBlockProps) {
  const verificationBadges = summary.badges.filter((b) => b.type === "verified")
  const achievementBadges = summary.badges.filter((b) => b.type !== "verified")

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Confiança
          </p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-foreground">
              {TRUST_LEVEL_LABELS[trustLevel]}
            </span>
            <span className="text-xs text-muted-foreground">
              Índice {summary.trustScore.toFixed(1)}
            </span>
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {TRUST_LEVEL_CONTEXT[trustLevel]}
      </p>

      {verificationBadges.length > 0 && (
        <div className="mt-4 border-t border-border/70 pt-3">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Verificações
          </p>
          <div className="flex flex-wrap gap-1.5">
            {verificationBadges.map((badge) => (
              <ReputationBadgePill key={badge.type} badge={badge} size="sm" />
            ))}
          </div>
        </div>
      )}

      {achievementBadges.length > 0 && (
        <div className="mt-4 border-t border-border/70 pt-3">
          <p className="mb-2 flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="size-3" />
            Conquistas reputacionais
          </p>
          <div className="flex flex-wrap gap-1.5">
            {achievementBadges.map((badge) => (
              <ReputationBadgePill key={badge.type} badge={badge} size="sm" />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
