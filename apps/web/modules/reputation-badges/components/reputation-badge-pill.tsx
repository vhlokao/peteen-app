import type { ReputationBadge } from "../domain/types"
import { REPUTATION_BADGE_META } from "../domain/constants"

type ReputationBadgePillProps = {
  badge: ReputationBadge
  size?: "xs" | "sm"
  /** "dark" — versão clara sobre fundo escuro (ex.: capa navy do perfil público). Default "light" preserva o visual atual. */
  tone?: "light" | "dark"
}

export function ReputationBadgePill({
  badge,
  size = "xs",
  tone = "light",
}: ReputationBadgePillProps) {
  const meta = REPUTATION_BADGE_META[badge.type]
  const sizeClass =
    size === "xs"
      ? "px-2 py-0.5 text-[0.65rem]"
      : "px-2.5 py-1 text-xs"
  const toneClass =
    tone === "dark" ? "border-white/25 bg-white/20 text-white" : meta.className

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${toneClass} ${sizeClass}`}
      title={badge.description}
      aria-label={`${badge.label} — ${badge.description}`}
    >
      {badge.type === "verified" && <span className="mr-0.5" aria-hidden="true">✓</span>}
      {badge.label}
    </span>
  )
}
