"use client"

import { Share2 } from "lucide-react"
import { toast } from "sonner"

type ShareButtonProps = {
  /** Nome do profissional — usado no título/texto do compartilhamento. */
  professionalName: string
}

/**
 * Botão Compartilhar do perfil público — visual navy circular.
 *
 * Client Component: um onClick em elemento nativo não pode ser passado como
 * prop a partir de um Server Component (page.tsx) — era exatamente isso que
 * causava "Event handlers cannot be passed to Client Component props" em
 * produção antes desta extração.
 *
 * Usa a Web Share API nativa quando disponível (mobile, principalmente);
 * cai para copiar o link no clipboard quando o navegador não suporta.
 */
export function ShareButton({ professionalName }: ShareButtonProps) {
  async function handleShare() {
    const shareData = {
      title: professionalName,
      text: `Veja o perfil de ${professionalName} na Peteen`,
      url: window.location.href,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // Usuário cancelou o compartilhamento — não é erro, não faz nada.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(shareData.url)
      toast.success("Link copiado!")
    } catch {
      toast.error("Não foi possível copiar o link.")
    }
  }

  return (
    <button
      type="button"
      aria-label="Compartilhar"
      onClick={handleShare}
      className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-white/[.12] text-white transition-colors hover:bg-white/[.18]"
    >
      <Share2 className="size-[18px]" />
    </button>
  )
}
