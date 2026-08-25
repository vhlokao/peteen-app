import { CheckCircle2, Repeat2, ShieldCheck, Sparkles, Star } from "lucide-react"

import { TRUST_LEVEL_LABELS, type TrustLevel } from "@/modules/professional/domain/types"
import type { ReputationTrustSummary } from "@/modules/reputation-badges/domain/types"
import { ReputationBadgePill } from "@/modules/reputation-badges/components/reputation-badge-pill"

const CORAL = "#E07A5F"
const GREEN = "#40916C"
const NAVY = "#1D2F6F"

const TRUST_LEVEL_CONTEXT: Record<TrustLevel, string> = {
  INITIAL: "Sua confiança está em construção. Conclua atendimentos e receba avaliações para evoluir.",
  BUILDING: "Você já está construindo uma reputação sólida na rede.",
  ESTABLISHED: "Seu perfil já é reconhecido como confiável pelos tutores.",
  // Sem "destaque": a palavra lê como posição patrocinada, e o Ranking não
  // considera plano nem pagamento. Mesma decisão já tomada em
  // professional-trust-overview.tsx (Home) e em TRUST_LEVEL_LABELS — esta era
  // a última superfície que ainda divergia.
  TRUSTED: "Sua reputação reflete um histórico consistente de bons atendimentos.",
  ELITE: "Você alcançou o nível mais alto de confiança da rede Peteen.",
}

type ProfessionalProfileTrustBlockProps = {
  trustLevel: TrustLevel
  summary: ReputationTrustSummary
  isVerified: boolean
}

/**
 * Confiança em linguagem humana — nível + explicação curta + 3 stats
 * reais ("reputação humana") + identidade verificada (booleano literal do
 * profile, não mais a lista de badges "verified") + Conquistas. Nenhuma
 * fórmula, peso ou breakdown técnico. O índice numérico, se aparecer, vem
 * sempre junto do nível, nunca isolado.
 */
export function ProfessionalProfileTrustBlock({
  trustLevel,
  summary,
  isVerified,
}: ProfessionalProfileTrustBlockProps) {
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
          {/* Linha inteira para a faixa, como na Home: lado a lado com o
              número, a 320px os dois quebravam e apareciam com peso visual
              igual — sendo que a faixa é a leitura principal. */}
          <p className="mt-0.5 text-lg font-semibold leading-tight text-foreground">
            {TRUST_LEVEL_LABELS[trustLevel]}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {TRUST_LEVEL_CONTEXT[trustLevel]}
      </p>

      {/* Mesmo formato da Home — inteiro e COM escala. Antes eram "67.0" aqui
          e "67 de 100" lá: o mesmo profissional via dois números diferentes
          para a mesma coisa, e "67.0" sozinho não responde "isso é bom?". */}
      <p className="mt-2 text-sm text-muted-foreground">
        Índice de confiança:{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {summary.trustScore.toFixed(0)} de 100
        </span>
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/70 pt-4">
        <div className="rounded-xl p-3 text-center" style={{ background: `${CORAL}14` }}>
          <Repeat2 className="mx-auto size-4" style={{ color: CORAL }} />
          <p className="mt-1.5 text-lg font-bold tabular-nums text-foreground">
            {summary.recurringClientsCount}
          </p>
          <p className="text-[0.65rem] leading-tight text-muted-foreground">tutores voltaram</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: `${GREEN}14` }}>
          <CheckCircle2 className="mx-auto size-4" style={{ color: GREEN }} />
          <p className="mt-1.5 text-lg font-bold tabular-nums text-foreground">
            {summary.completedServices}
          </p>
          <p className="text-[0.65rem] leading-tight text-muted-foreground">atendimentos</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: `${NAVY}14` }}>
          <Star className="mx-auto size-4" style={{ color: NAVY }} />
          <p className="mt-1.5 text-lg font-bold tabular-nums text-foreground">
            {summary.averageRating !== null ? summary.averageRating.toFixed(1) : "—"}
          </p>
          <p className="text-[0.65rem] leading-tight text-muted-foreground">avaliação média</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2.5 border-t border-border/70 pt-4">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={
            isVerified
              ? { background: `${GREEN}22`, color: GREEN }
              : { background: "#F0EEE8", color: "#8A897F" }
          }
        >
          <ShieldCheck className="size-4" />
        </span>
        <p className="text-sm font-medium" style={{ color: isVerified ? GREEN : undefined }}>
          {isVerified ? "Identidade verificada" : "Identidade não verificada"}
        </p>
      </div>

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
