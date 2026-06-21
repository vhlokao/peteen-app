/**
 * BadgePill — badge compacto para exibição em cards de discovery.
 *
 * Máximo 2 por card (regra de negócio em getBadgesForCard).
 * Não é gamificação — é sinal de confiança legível.
 */

import type { BadgeData } from "@/modules/badges/domain/types"

const BADGE_COLORS: Record<string, string> = {
  TRUSTED:      "bg-green-50 text-green-700 border-green-200",
  HIGHLY_RATED: "bg-amber-50 text-amber-700 border-amber-200",
  RECURRING:    "bg-blue-50 text-blue-700 border-blue-200",
  EXPERT:       "bg-purple-50 text-purple-700 border-purple-200",
  FIRST_CLIENT: "bg-teal-50 text-teal-700 border-teal-200",
}

type Props = {
  badge: BadgeData
  size?: "sm" | "xs"
}

export function BadgePill({ badge, size = "xs" }: Props) {
  const colorClass = BADGE_COLORS[badge.type] ?? "bg-muted text-muted-foreground border-border"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${colorClass} ${
        size === "xs" ? "text-[0.6rem]" : "text-xs"
      }`}
      title={badge.description}
    >
      <span aria-hidden>{badge.emoji}</span>
      {badge.label}
    </span>
  )
}
