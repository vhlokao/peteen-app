import { Star } from "lucide-react"

import type { ProfessionalReviewsData } from "../domain/types"

function StarBar({ count, total }: { count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-right tabular-nums text-muted-foreground">{count}</span>
    </div>
  )
}

/**
 * Resumo real — média, quantidade e distribuição já calculadas por
 * getProfessionalReviewsData. Nenhuma média paralela, nenhum NPS.
 */
export function ProfessionalReviewsSummary({ data }: { data: ProfessionalReviewsData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="text-center">
          <p className="flex items-center justify-center gap-1 text-3xl font-semibold tabular-nums text-foreground">
            {data.averageRating ?? "—"}
            <Star className="size-5 fill-amber-400 text-amber-400" />
          </p>
          <p className="text-xs text-muted-foreground">Média geral</p>
        </div>
        <div className="h-10 w-px bg-border/70" />
        <div className="text-center">
          <p className="text-3xl font-semibold tabular-nums text-foreground">
            {data.totalReviews}
          </p>
          <p className="text-xs text-muted-foreground">
            avaliaç{data.totalReviews === 1 ? "ão" : "ões"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Distribuição
        </p>
        <div className="space-y-1">
          {([5, 4, 3, 2, 1] as const).map((star) => (
            <div key={star} className="flex items-center gap-2">
              <span className="w-3 text-xs text-muted-foreground">{star}★</span>
              <StarBar count={data.distribution[star]} total={data.totalReviews} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
