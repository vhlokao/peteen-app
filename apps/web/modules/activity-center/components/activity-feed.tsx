import { ActivityCard } from "./activity-card"
import { ActivityEmptyState } from "./activity-empty-state"
import type { ActivityItem } from "../domain/types"

export function ActivityFeed({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: ActivityItem[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (items.length === 0) {
    return <ActivityEmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <ActivityCard item={item} />
        </li>
      ))}
    </ul>
  )
}
