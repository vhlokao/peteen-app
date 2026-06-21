import { Star } from "lucide-react"

import { SPECIES_LABELS, type Species } from "@/modules/tutor/domain/types"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { Badge } from "@/components/ui/badge"
import type { ReviewWithContext } from "@/modules/review/domain/types"

type ReviewCardProps = {
  review: ReviewWithContext
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function ReviewCard({ review }: ReviewCardProps) {
  const { tutor, rating, comment, serviceType, petContext, createdAt, isRecurringRelationship } = review

  const petSpecies = (petContext as { species?: Species })?.species
  const tutorInitials = tutor.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {/* Header: autor + rating + data */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
            aria-hidden="true"
          >
            {tutorInitials}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground leading-tight">
              {tutor.displayName}
            </p>
            {isRecurringRelationship && (
              <p className="text-[0.65rem] text-muted-foreground">Cliente recorrente</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <StarRating rating={rating} />
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {formatDate(createdAt)}
          </p>
        </div>
      </div>

      {/* Comentário */}
      {comment && (
        <p className="text-sm leading-relaxed text-foreground">{comment}</p>
      )}

      {/* Contexto: serviço + espécie do pet */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[0.65rem] font-normal">
          {SERVICE_TYPE_LABELS[serviceType as ServiceType]}
        </Badge>
        {petSpecies && (
          <Badge variant="outline" className="text-[0.65rem] font-normal">
            {SPECIES_LABELS[petSpecies]}
          </Badge>
        )}
      </div>
    </div>
  )
}
