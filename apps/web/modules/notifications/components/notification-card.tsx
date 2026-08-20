import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { NotificationItem } from "../domain/types"
import { DEFAULT_NOTIFICATION_ICON, NOTIFICATION_ICONS } from "./notification-icons"

/**
 * Conteúdo visual de um item da central.
 *
 * NÃO LIDA vs LIDA é comunicada por TRÊS sinais independentes, nunca só por
 * cor (item 13 da missão — WCAG 1.4.1): um ponto sólido antes do título, o
 * rótulo textual "Nova", e o peso da borda/fundo do card. Quem não distingue
 * as cores, ou está no modo alto contraste, continua conseguindo separar as
 * duas categorias.
 */
export function NotificationCardContent({ item }: { item: NotificationItem }) {
  const Icon = NOTIFICATION_ICONS[item.type] ?? DEFAULT_NOTIFICATION_ICON
  const naoLida = item.isRead === false

  return (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
          naoLida ? "bg-primary/10" : "bg-muted"
        )}
      >
        <Icon className={cn("size-4", naoLida ? "text-primary" : "text-muted-foreground")} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {naoLida ? (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          ) : null}
          <p
            className={cn(
              "text-sm text-foreground",
              naoLida ? "font-semibold" : "font-medium"
            )}
          >
            {item.title}
          </p>
          {naoLida ? (
            <Badge variant="secondary" className="text-[0.6rem]">
              Nova
            </Badge>
          ) : null}
          {item.priority === "high" ? (
            <Badge variant="destructive" className="text-[0.6rem]">
              Atenção
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{item.description}</p>
        <p className="mt-1 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
          <Clock className="size-3" />
          {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </>
  )
}

/** Classes do contêiner do card — compartilhadas entre a versão link e a estática. */
export function notificationCardClasses(item: NotificationItem, interactive: boolean) {
  const naoLida = item.isRead === false
  return cn(
    "flex items-start gap-3 rounded-xl border p-4 transition-colors",
    naoLida ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card",
    interactive &&
      "text-left hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
  )
}
