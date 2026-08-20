"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { buildBellAriaLabel, formatBadgeCount } from "../domain/read-state"

type Props = {
  href: string
  /** NÃO LIDAS — não "eventos recentes". Ver domain/read-state.ts. */
  count?: number
  className?: string
  showLabel?: boolean
}

/**
 * Sino da central de notificações.
 *
 * MICROFEEDBACK (item F da missão): quando a contagem SOBE com a aba já
 * aberta, o sino balança uma vez. Uma vez — não é loop, não é pulso
 * contínuo: um sino piscando indefinidamente vira ruído que o usuário
 * aprende a ignorar, e é hostil para quem tem sensibilidade a movimento.
 * A animação se auto-desliga no fim (`onAnimationEnd`) e a regra CSS inteira
 * é anulada sob `prefers-reduced-motion` (ver globals.css) — nesse caso o
 * badge aparece sem nenhum movimento, o que já comunica a novidade.
 *
 * A contagem só é comparada DEPOIS do primeiro render: montar a página com 3
 * não lidas não é "chegou algo agora", é estado inicial, e balançar nesse
 * caso seria mentira visual.
 */
export function NotificationBell({ href, count = 0, className, showLabel }: Props) {
  const badgeText = formatBadgeCount(count)
  const [chamando, setChamando] = useState(false)
  const contagemAnteriorRef = useRef(count)

  useEffect(() => {
    if (count > contagemAnteriorRef.current) setChamando(true)
    contagemAnteriorRef.current = count
  }, [count])

  return (
    <Link
      href={href}
      aria-label={buildBellAriaLabel(count)}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        // Não-lidas também mudam a COR do próprio sino: o badge sozinho é um
        // alvo pequeno, e em telas de 320px ele encosta na borda do ícone.
        count > 0 ? "text-foreground" : "text-muted-foreground",
        className
      )}
    >
      <Bell
        className={cn("size-4", chamando && "notification-bell-ring")}
        onAnimationEnd={() => setChamando(false)}
      />
      {showLabel ? <span>Notificações</span> : null}
      {badgeText ? (
        <Badge
          variant="destructive"
          // aria-hidden: o texto acessível completo já está no aria-label do
          // link — sem isto o leitor de tela anunciaria "9+" solto, sem
          // contexto, depois de já ter lido "3 não lidas".
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center px-1 py-0 text-[0.55rem] leading-none"
        >
          {badgeText}
        </Badge>
      ) : null}
    </Link>
  )
}
