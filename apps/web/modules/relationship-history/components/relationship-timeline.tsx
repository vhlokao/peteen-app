import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Circle, Star } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  RelationshipRequestRow,
  RelationshipReviewRow,
  RelationshipSummary,
} from "../domain/types"

type TimelineEvent = {
  id: string
  label: string
  sublabel?: string
  date: Date
  kind: "service" | "review" | "milestone"
}

function buildTimelineEvents(
  summary: RelationshipSummary,
  requests: RelationshipRequestRow[],
  reviews: RelationshipReviewRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  const completed = requests.filter((r) => r.status === "COMPLETED")
  for (const req of completed) {
    events.push({
      id: `req-${req.id}`,
      label: `${req.serviceLabel} concluído`,
      sublabel: req.petName ? `Pet: ${req.petName}` : undefined,
      date: req.occurredAt,
      kind: "service",
    })
  }

  for (const review of reviews) {
    events.push({
      id: `rev-${review.id}`,
      label: `Review enviada — ${review.rating} estrelas`,
      sublabel: review.comment ?? undefined,
      date: review.createdAt,
      kind: "review",
    })
  }

  if (summary.completedServices > 0 && summary.isRecurring) {
    const lastCompleted = completed[0]
    if (lastCompleted) {
      events.push({
        id: "milestone-recurring",
        label: "Relacionamento recorrente estabelecido",
        date: lastCompleted.occurredAt,
        kind: "milestone",
      })
    }
  }

  return events
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8)
}

export function RelationshipTimeline({
  summary,
  requests,
  reviews,
}: {
  summary: RelationshipSummary
  requests: RelationshipRequestRow[]
  reviews: RelationshipReviewRow[]
}) {
  const events = buildTimelineEvents(summary, requests, reviews)
  const fmt = (d: Date) => format(d, "dd MMM yyyy", { locale: ptBR })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linha do tempo</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </p>
        ) : (
          <ul className="space-y-4">
            {events.map((event, index) => (
              <li key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {event.kind === "review" ? (
                    <Star className="size-4 shrink-0 fill-amber-400 text-amber-400" />
                  ) : (
                    <Circle
                      className={`size-4 shrink-0 ${
                        event.kind === "milestone"
                          ? "fill-emerald-500 text-emerald-500"
                          : "fill-primary text-primary"
                      }`}
                    />
                  )}
                  {index < events.length - 1 && (
                    <div className="mt-1 w-px flex-1 bg-border" />
                  )}
                </div>
                <div className="min-w-0 pb-2">
                  <p className="text-sm font-medium">{event.label}</p>
                  {event.sublabel && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {event.sublabel}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmt(event.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
