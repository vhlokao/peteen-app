"use client"

import { Check, Share2 } from "lucide-react"

import { cardInteractiveClasses } from "@/components/ui/card"
import { useShareProfile } from "./use-share-profile"

const NAVY = "#1D2F6F"

/**
 * "Compartilhar meu perfil" como card de Ação rápida.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE HORIZONTAL, E NÃO UM TERCEIRO CARD QUADRADO
 *
 * Os outros dois atalhos são quadrados numa grade de 2 colunas. Um terceiro
 * quadrado deixaria um órfão na segunda fila; três colunas dariam 88px por
 * card em 320px, e "Compartilhar meu perfil" quebraria em três linhas.
 *
 * Ocupando a linha inteira em formato horizontal, o card cabe em qualquer
 * largura, não deixa buraco na grade e — o que importa mais — fica
 * visualmente distinto dos vizinhos, o que é honesto: os outros dois navegam
 * para uma tela, este DISPARA uma ação com feedback. Parecer igual a um link
 * de navegação seria mentir sobre o que acontece ao tocar.
 *
 * É um <button>, não um <Link>: não há destino, e um leitor de tela precisa
 * anunciar "botão" para que a pessoa saiba que algo vai acontecer ali mesmo.
 */
export function ShareProfileAction({
  professionalId,
  professionalName,
}: {
  professionalId: string
  professionalName: string
}) {
  const { copiado, compartilhar } = useShareProfile(professionalId, professionalName)

  return (
    <button
      type="button"
      onClick={compartilhar}
      // `touch-target` é a utility do Design System (globals.css) que aplica
      // --touch-target-min; usar a variável solta aqui duplicaria a regra e
      // sairia do padrão que o resto do app já segue.
      className={`touch-target col-span-2 flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${cardInteractiveClasses}`}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${NAVY}14`, color: NAVY }}
      >
        {copiado ? (
          <Check className="size-5" aria-hidden="true" />
        ) : (
          <Share2 className="size-5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {copiado ? "Link copiado" : "Compartilhar meu perfil"}
        </span>
        {/* A segunda linha responde "por que eu faria isso?" — sem ela, o card
            é só um verbo solto no meio de dois atalhos de navegação. */}
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Envie seu link para tutores
        </span>
      </span>
    </button>
  )
}
