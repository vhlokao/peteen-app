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
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-primary" aria-hidden>
          {BLOCK_ICON[block.id] ?? <Sparkles className="size-4" />}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{block.title}</h2>
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
      className="flex w-44 shrink-0 flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <Avatar className="size-9 shrink-0">
          {pro.avatarUrl && <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />}
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
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

      <p className="truncate text-[0.65rem] font-medium text-primary">{pro.score.mainReason}</p>
    </Link>
  )
}
