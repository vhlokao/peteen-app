import { Star } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import type { ProfessionalReviewRow } from "../domain/types"

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

type ProfessionalReviewCardProps = {
  review: ProfessionalReviewRow
  relationshipBadge: string | null
}

/**
 * Card humano de avaliação — tutor, pet/serviço (quando reais), nota,
 * comentário e um badge de relação real (recorrente/primeiro atendimento),
 * derivado da lista de clientes já buscada, sem análise de sentimento.
 */
export function ProfessionalReviewCard({ review, relationshipBadge }: ProfessionalReviewCardProps) {
  const initials = review.tutorName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <Avatar className="size-10 shrink-0 rounded-xl">
          <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{review.tutorName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {review.serviceType && <span>{SERVICE_TYPE_LABELS[review.serviceType as ServiceType]}</span>}
            {review.petName && (
              <>
                <span className="text-border">·</span>
                <span>{review.petName}</span>
              </>
            )}
            <span className="text-border">·</span>
            <span>{formatDate(review.createdAt)}</span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {review.rating}
          <Star className="size-3 fill-amber-500 text-amber-500" />
        </span>
      </div>

      {review.comment && (
        <p className="text-sm leading-relaxed text-foreground/85">{review.comment}</p>
      )}

      {relationshipBadge && (
        <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary">
          {relationshipBadge}
        </span>
      )}
    </div>
  )
}
