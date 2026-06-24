import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Clock } from "lucide-react"

import type { ActivityItem } from "../domain/types"
import { ACTIVITY_ICONS, DEFAULT_ACTIVITY_ICON } from "./activity-icons"

export function ActivityCard({ item }: { item: ActivityItem }) {
  const Icon = ACTIVITY_ICONS[item.type] ?? DEFAULT_ACTIVITY_ICON

  const content = (
    <>
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        <p className="text-sm text-muted-foreground">{item.description}</p>
        {item.actorName ? (
          <p className="mt-0.5 text-xs text-muted-foreground">por {item.actorName}</p>
        ) : null}
        <p className="mt-1 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
          <Clock className="size-3" />
          {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </>
  )

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/20"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      {content}
    </div>
  )
}
