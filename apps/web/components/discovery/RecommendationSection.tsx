/**
 * RecommendationSection — blocos de recomendação para o Discovery.
 *
 * Renderiza até 4 blocos (for_you, top_rated, recurring, verified),
 * cada um com scroll horizontal de cards compactos.
 *
 * Blocos vazios são automaticamente omitidos.
 */

import Link from "next/link"
import { ShieldCheck, Star } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type {
  RecommendationBlock,
  RecommendedProfessional,
} from "@/modules/recommendation/domain/types"

const BLOCK_ICON: Record<string, string> = {
  for_you:   "✨",
  top_rated: "⭐",
  recurring: "🔁",
  verified:  "✓",
}

// ── Wrapper dos blocos ────────────────────────────────────────────────────────

type SectionProps = {
  blocks: RecommendationBlock[]
}

export function RecommendationSection({ blocks }: SectionProps) {
  const active = blocks.filter((b) => b.professionals.length > 0)
  if (active.length === 0) return null

  return (
    <div className="space-y-8">
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
      {/* Cabeçalho */}
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 text-base leading-none" aria-hidden>
          {BLOCK_ICON[block.id] ?? "•"}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{block.title}</h2>
          <p className="text-xs text-muted-foreground">{block.description}</p>
        </div>
      </div>

      {/* Cards em scroll horizontal */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
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
      className="group flex w-44 shrink-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-md"
    >
      {/* Identidade */}
      <div className="flex items-center gap-2">
        <Avatar className="size-8 shrink-0">
          {pro.avatarUrl && (
            <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />
          )}
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

      {/* Avaliação */}
      {pro.averageRating !== null && pro.reviewCount > 0 && (
        <div className="flex items-center gap-1">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          <span className="text-[0.65rem] font-semibold tabular-nums">
            {pro.averageRating.toFixed(1)}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">
            ({pro.reviewCount})
          </span>
        </div>
      )}

      {/* Motivo principal da recomendação */}
      <p className="truncate text-[0.65rem] font-medium text-primary">
        {pro.score.mainReason}
      </p>

      {/* Barra de score visual */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/50 transition-all"
          style={{ width: `${pro.score.totalScore}%` }}
        />
      </div>
    </Link>
  )
}
