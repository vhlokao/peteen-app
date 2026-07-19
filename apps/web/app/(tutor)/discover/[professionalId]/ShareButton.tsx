"use client"

import { Share2 } from "lucide-react"

/**
 * Botão Compartilhar do perfil público — visual navy circular.
 *
 * Sem ação real ainda (só visual, per item 5 da missão). Precisa ser Client
 * Component: um onClick em elemento nativo não pode ser passado como prop
 * a partir de um Server Component (page.tsx) — era exatamente isso que
 * causava "Event handlers cannot be passed to Client Component props" em
 * produção.
 */
export function ShareButton() {
  return (
    <button
      type="button"
      aria-label="Compartilhar"
      onClick={() => {}}
      className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-white/[.12] text-white transition-colors hover:bg-white/[.18]"
    >
      <Share2 className="size-[18px]" />
    </button>
  )
}
