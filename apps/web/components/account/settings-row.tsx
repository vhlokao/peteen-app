import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Linha de configuração — ícone + título + descrição curta + chevron.
 *
 * REGRA DE ACESSIBILIDADE (item 16 da missão): a linha inteira é clicável
 * SOMENTE quando não há nenhum controle próprio dentro dela. Uma linha-link
 * com um botão/toggle aninhado produz alvos sobrepostos, ordem de foco
 * ambígua e, em leitor de tela, um link cujo nome acessível engole o
 * controle interno. Para esses casos existe `SettingsStaticRow`, que não é
 * clicável e hospeda o controle.
 */
export function SettingsLinkRow({
  href,
  icon: Icon,
  title,
  description,
  external,
}: {
  href: string
  icon: LucideIcon
  title: string
  description?: string
  external?: boolean
}) {
  const externalProps = external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {}

  return (
    <Link
      href={href}
      {...externalProps}
      className={cn(
        // min-h respeita o alvo mínimo de toque do design system — em 320px
        // uma linha com título curto ficaria abaixo do mínimo sem isto.
        "flex min-h-[var(--touch-target-min)] items-center gap-3 px-4 py-3.5 transition-colors",
        "hover:bg-muted/40 active:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      )}
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

/**
 * Linha não clicável — para seções que hospedam o próprio controle
 * (ex.: o botão de ativar notificações). Ver a nota sobre alvos aninhados
 * em `SettingsLinkRow`.
 */
export function SettingsStaticRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  /**
   * Opcional desde GATE-10: quando o próprio controle já anuncia o assunto e o
   * estado (a seção de notificações), um título de linha acima dele só repete a
   * mesma frase com menos informação. Sem título, o ícone divide a linha com o
   * controle em vez de ficar sozinho numa faixa vazia.
   */
  title?: string
  description?: string
  children?: React.ReactNode
}) {
  if (!title) {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

/**
 * Grupo de configurações — título discreto acima de um cartão com linhas
 * separadas por divisor. É o padrão de apps de consumo maduros: o usuário
 * varre os títulos de grupo, não a lista inteira.
 */
export function SettingsGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        {children}
      </div>
    </section>
  )
}
