import Link from "next/link"
import { ChevronRight, Star } from "lucide-react"

type ProfessionalRatingSummaryProps = {
  averageRating: number | null
  totalReviews: number
}

export function ProfessionalRatingSummary({
  averageRating,
  totalReviews,
}: ProfessionalRatingSummaryProps) {
  return (
    <Link
      href="/professional/reviews"
      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <Star className="size-5 fill-current" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Avaliações
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {averageRating !== null
              ? `${averageRating.toFixed(1)} de média · ${totalReviews} avaliaç${totalReviews === 1 ? "ão" : "ões"}`
              : "Ainda sem avaliações"}
          </p>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
