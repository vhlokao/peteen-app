/**
 * RecommendationSection — blocos de recomendação para o Discovery.
 *
 * Renderiza até 4 blocos (for_you, top_rated, recurring, verified),
 * cada um com scroll horizontal de cards compactos.
 *
 * Blocos vazios são automaticamente omitidos. Nenhum score bruto é exibido —
 * só o "mainReason" humano já calculado pela Recommendation Engine.
 */

import type { ReactNode } from "react"
import Link from "next/link"
import { RefreshCw, ShieldCheck, Sparkles, Star } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type {
  RecommendationBlock,
  RecommendedProfessional,
} from "@/modules/recommendation/domain/types"

const BLOCK_ICON: Record<string, ReactNode> = {
  for_you: <Sparkles className="size-4" />,
  top_rated: <Star className="size-4" />,
  recurring: <RefreshCw className="size-4" />,
  verified: <ShieldCheck className="size-4" />,
}

// ── Wrapper dos blocos ────────────────────────────────────────────────────────

type SectionProps = {
  blocks: RecommendationBlock[]
}

export function RecommendationSection({ blocks }: SectionProps) {
  const active = blocks.filter((b) => b.professionals.length > 0)
  if (active.length === 0) return null

  return (
    <div className="space-y-7">
      {active.map((block) => (
        <RecommendationBlockRow key={block.id} block={block} />
      ))}
    </div>
  )
}

// ── Bloco individual ─────────────────────────────────────────────────────────

function RecommendationBlockRow({ block }: { block: RecommendationBlock }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          {BLOCK_ICON[block.id] ?? <Sparkles className="size-4" />}
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{block.title}</h2>
          <p className="text-xs text-muted-foreground">{block.description}</p>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {block.professionals.map((pro) => (
          <RecommendedCard key={pro.professionalId} pro={pro} />
        ))}
      </div>
    </section>
  )
}

// ── Card compacto ─────────────────────────────────────────────────────────────

function RecommendedCard({ pro }: { pro: RecommendedProfessional }) {
  const initials = pro.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()

  return (
    <Link
      href={`/discover/${pro.professionalId}`}
      className="flex w-[10.5rem] shrink-0 flex-col gap-2.5 rounded-2xl border border-border/70 bg-card p-3.5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-center gap-2">
        <Avatar className="size-10 shrink-0 rounded-xl ring-1 ring-border/60">
          {pro.avatarUrl && <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />}
          <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-xs font-semibold leading-tight text-foreground">
              {pro.displayName}
            </span>
            {pro.isVerified && (
              <ShieldCheck className="size-3 shrink-0 text-primary" aria-label="Verificado" />
            )}
          </div>
          <p className="truncate text-[0.65rem] text-muted-foreground">{pro.city}</p>
        </div>
      </div>

      {pro.averageRating !== null && pro.reviewCount > 0 && (
        <div className="flex items-center gap-1">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          <span className="text-[0.65rem] font-semibold tabular-nums">
            {pro.averageRating.toFixed(1)}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">({pro.reviewCount})</span>
        </div>
      )}

      <span className="w-fit truncate rounded-md bg-primary/8 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary">
        {pro.score.mainReason}
      </span>
    </Link>
  )
}
