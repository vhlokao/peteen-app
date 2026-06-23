import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  Link2,
  RefreshCw,
  Clock,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PartnerActivityItem, PartnerActivityType } from "../domain/types"

const ACTIVITY_ICONS: Record<PartnerActivityType, typeof ThumbsUp> = {
  "recommendation.created": ThumbsUp,
  "recommendation.removed": ThumbsDown,
  "verification.approved": ShieldCheck,
  "connection.active": Link2,
  "professional.recurring": RefreshCw,
}

export function PartnerRecentActivity({
  items,
}: {
  items: PartnerActivityItem[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atividade recente</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma atividade ainda. Suas recomendações e conexões aparecerão aqui.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const Icon = ACTIVITY_ICONS[item.type]
              const content = (
                <>
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.description}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                      <Clock className="size-3" />
                      {formatDistanceToNow(item.occurredAt, {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </>
              )

              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/40"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 rounded-lg p-2">
                      {content}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
