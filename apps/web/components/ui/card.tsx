import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Recipe compartilhada para um card CLICÁVEL (`<Link>` ou `<button>` que
 * envolve o conteúdo de um card, nunca `<div onClick>` — teclado precisa
 * alcançar a ação).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE
 *
 * Vários cards clicáveis do produto já tinham hover próprio
 * (`hover:-translate-y-0.5 hover:border-primary/25
 * hover:shadow-[var(--shadow-card-hover)]`), copiado e colado arquivo a
 * arquivo — sem `active:` (nenhum feedback de toque/clique enquanto
 * pressionado) e sem `focus-visible:` explícito (o card ficava só com o
 * outline padrão do navegador, que não usa o token `--ring` do resto do
 * produto). Extrair para cá é o que evita a próxima tela repetir a mesma
 * lacuna — mesmo raciocínio de `buttonVariants` em button.tsx.
 *
 * `focus-visible:ring-3 focus-visible:ring-ring/50` é literal do Button, de
 * propósito: um card clicável é, na prática, um botão grande — o anel de
 * foco precisa ser o MESMO token, não uma variação.
 *
 * `active:translate-y-0` desfaz o lift do hover: como o hover já sobe o card
 * (`-translate-y-0.5`), "soltar" no active/press é o card voltar ao lugar —
 * a sensação de afundar, sem introduzir uma transformação nova.
 *
 * NÃO aplicar a card que não navega nem executa ação — um card estático com
 * hover de botão engana o usuário a tentar clicar nele (item 10.E).
 */
export const cardInteractiveClasses =
  "transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)] active:translate-y-0 active:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
