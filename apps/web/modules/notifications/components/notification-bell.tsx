import Link from "next/link"
import { Bell } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Props = {
  href: string
  count?: number
  className?: string
  showLabel?: boolean
}

export function NotificationBell({ href, count = 0, className, showLabel }: Props) {
  const displayCount = count > 99 ? "99+" : String(count)

  return (
    <Link
      href={href}
      aria-label={`Notificações${count > 0 ? `, ${count} recentes` : ""}`}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <Bell className="size-4" />
      {showLabel ? <span>Notificações</span> : null}
      {count > 0 ? (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 flex size-4 items-center justify-center p-0 text-[0.55rem] leading-none"
        >
          {displayCount}
        </Badge>
      ) : null}
    </Link>
  )
}
