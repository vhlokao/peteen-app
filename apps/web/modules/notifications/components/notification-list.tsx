import { NotificationCardContent, notificationCardClasses } from "./notification-card"
import { NotificationEmptyState } from "./notification-empty-state"
import type { NotificationItem } from "../domain/types"

/**
 * Feed estático, sem estado de leitura — usado por Parceiro e Admin.
 *
 * Tutor e Profissional usam `NotificationFeed` (client), que soma leitura,
 * "marcar todas" e probe. Estes dois papéis ficaram de fora do piloto por
 * escopo: `notification_reads` é por usuário e serviria aos dois sem
 * mudança de schema, mas o Admin ainda tem um evento sem chave estável
 * (`notif-admin-partner-unlinked`, que usa `new Date()` como createdAt) —
 * dívida registrada, deliberadamente não misturada com o piloto.
 */
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
    return <NotificationEmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          {item.href ? (
            <a href={item.href} className={notificationCardClasses(item, true)}>
              <NotificationCardContent item={item} />
            </a>
          ) : (
            <div className={notificationCardClasses(item, false)}>
              <NotificationCardContent item={item} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
