/**
 * BadgeList — exibição completa de badges e selos de verificação.
 *
 * Usado no perfil público do profissional.
 * Mostra todos os badges conquistados + selos de verificação ativos.
 */

import type { BadgeData, VerificationData } from "@/modules/badges/domain/types"

type Props = {
  badges:        BadgeData[]
  verifications: VerificationData[]
}

/**
 * Versão compacta (UX 3.5.1) — grid 2 colunas com ícone em container suave,
 * label + descrição truncada numa linha só. Antes eram blocos empilhados de
 * altura livre com 5 cores pastel diferentes competindo entre si; agora usa
 * um único tratamento visual neutro+azul, reduzindo a altura por item em
 * mais da metade no mobile. Nenhum dado real removido.
 */
export function BadgeList({ badges, verifications }: Props) {
  const activeVerifications = verifications.filter(
    (v) => v.active && !v.internalOnly
  )
  const hasContent = badges.length > 0 || activeVerifications.length > 0

  if (!hasContent) return null

  return (
    <div className="space-y-4">
      {/* Badges conquistados */}
      {badges.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Conquistas
          </h3>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {badges.map((badge) => (
              <div
                key={badge.type}
                title={badge.description}
                className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-3 py-2"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm" aria-hidden>
                  {badge.emoji}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold leading-tight text-foreground">
                    {badge.label}
                  </p>
                  <p className="truncate text-[0.65rem] text-muted-foreground">
                    {badge.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selos de verificação */}
      {activeVerifications.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Verificações
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {activeVerifications.map((v) => (
              <span
                key={v.type}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary"
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
