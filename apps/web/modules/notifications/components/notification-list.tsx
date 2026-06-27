import { NotificationCard } from "./notification-card"
import { NotificationEmptyState } from "./notification-empty-state"
import type { NotificationItem } from "../domain/types"

export function NotificationList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: NotificationItem[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (items.length === 0) {
    return (
      <NotificationEmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <NotificationCard item={item} />
        </li>
      ))}
    </ul>
  )
}
