import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Star } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProfessionalReviewsData } from "../domain/types"

function StarBar({ count, total }: { count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-amber-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span>
    </div>
  )
}

export function ProfessionalReviewsPanel({
  data,
}: {
  data: ProfessionalReviewsData
}) {
  const fmt = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Média geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-1 text-3xl font-semibold tabular-nums">
              {data.averageRating ?? "—"}
              <Star className="size-5 fill-amber-400 text-amber-400" />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de avaliações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{data.totalReviews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribuição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {([5, 4, 3, 2, 1] as const).map((star) => (
              <div key={star} className="flex items-center gap-2">
                <span className="w-3 text-xs text-muted-foreground">{star}</span>
                <StarBar count={data.distribution[star]} total={data.totalReviews} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avaliações recebidas</CardTitle>
        </CardHeader>
        <CardContent>
          {data.reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma avaliação ainda. Peça feedback após concluir atendimentos.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.reviews.map((review) => (
                <li key={review.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{review.tutorName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5 font-medium text-amber-600">
                        {review.rating}
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                      </span>
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
    </div>
  )
}
