import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Star } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RelationshipReviewRow } from "../domain/types"

type RelationshipReviewsListProps = {
  reviews: RelationshipReviewRow[]
  /** Texto quando vazio — varia entre visão tutor e profissional */
  emptyMessage?: string
  showAuthor?: boolean
}

export function RelationshipReviewsList({
  reviews,
  emptyMessage = "Nenhuma review enviada ainda.",
  showAuthor = false,
}: RelationshipReviewsListProps) {
  const fmt = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-border">
            {reviews.map((review) => (
              <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {showAuthor ? (
                    <p className="text-sm font-medium">{review.authorName}</p>
                  ) : (
                    <span className="flex items-center gap-0.5 text-sm font-medium text-amber-600">
                      {review.rating}
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {showAuthor && (
                      <span className="flex items-center gap-0.5 font-medium text-amber-600">
                        {review.rating}
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                      </span>
                    )}
                    <span>{fmt(review.createdAt)}</span>
                  </div>
                </div>
                {review.comment && (
                  <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
