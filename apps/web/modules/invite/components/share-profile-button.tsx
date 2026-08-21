"use client"

import { useState } from "react"
import { Check, Share2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  buildInviteLandingPath,
  buildShareMessage,
} from "@/modules/invite/domain/invite-visit"

/**
 * "Compartilhar meu perfil" — ação do profissional para convidar tutores.
 *
 * Compartilha a landing PÚBLICA (`/p/<id>`), não o perfil do Discovery: quem
 * recebe o link provavelmente ainda não tem conta, e `/discover/*` exige
 * sessão — mandaria a pessoa para uma parede de login antes de ela sequer
 * saber quem a convidou.
 *
 * Web Share API quando existe (é o caso no mobile, de onde a maioria destes
 * convites vai sair), com fallback de copiar para a área de transferência.
 * Mesmo par de estratégias já usado pelo ShareButton do perfil público.
 */
export function ShareProfileButton({
  professionalId,
  professionalName,
  className,
}: {
  professionalId: string
  professionalName: string
  className?: string
}) {
  const [copiado, setCopiado] = useState(false)

  async function handleShare() {
    // `window.location.origin` em vez de env var: funciona igual em preview,
    // produção e local, sem depender de configuração correta por ambiente.
    const url = `${window.location.origin}${buildInviteLandingPath(professionalId)}`
    const texto = buildShareMessage(professionalName, url)

    if (navigator.share) {
      try {
        await navigator.share({ title: "Meu perfil na Peteen", text: texto, url })
      } catch {
        // Cancelar o compartilhamento não é erro — não mostra nada.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      toast.success("Link copiado!")
      // Volta ao estado normal — o feedback é momentâneo, não permanente.
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error("Não foi possível copiar o link.")
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={`touch-target gap-2 ${className ?? ""}`}
      onClick={handleShare}
    >
      {copiado ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Share2 className="size-4" aria-hidden="true" />
      )}
      {copiado ? "Link copiado" : "Compartilhar meu perfil"}
    </Button>
  )
}
