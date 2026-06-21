/**
 * BadgeList — exibição completa de badges e selos de verificação.
 *
 * Usado no perfil público do profissional.
 * Mostra todos os badges conquistados + selos de verificação ativos.
 */

import type { BadgeData, VerificationData } from "@/modules/badges/domain/types"

const BADGE_COLORS: Record<string, string> = {
  TRUSTED:      "border-green-200 bg-green-50 text-green-800",
  HIGHLY_RATED: "border-amber-200 bg-amber-50 text-amber-800",
  RECURRING:    "border-blue-200 bg-blue-50 text-blue-800",
  EXPERT:       "border-purple-200 bg-purple-50 text-purple-800",
  FIRST_CLIENT: "border-teal-200 bg-teal-50 text-teal-800",
}

type Props = {
  badges:        BadgeData[]
  verifications: VerificationData[]
}

export function BadgeList({ badges, verifications }: Props) {
  const activeVerifications = verifications.filter((v) => v.active)
  const hasContent = badges.length > 0 || activeVerifications.length > 0

  if (!hasContent) return null

  return (
    <div className="space-y-4">
      {/* Badges conquistados */}
      {badges.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Badges conquistados
          </h3>
          <div className="flex flex-col gap-2">
            {badges.map((badge) => (
              <div
                key={badge.type}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  BADGE_COLORS[badge.type] ?? "border-border bg-muted/30 text-foreground"
                }`}
              >
                <span className="mt-0.5 text-xl" aria-hidden>
                  {badge.emoji}
                </span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{badge.label}</p>
                  <p className="mt-0.5 text-xs opacity-75">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selos de verificação */}
      {activeVerifications.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Verificações
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeVerifications.map((v) => (
              <span
                key={v.type}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                title={v.description}
              >
                <span aria-hidden>{v.emoji}</span>
                {v.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
