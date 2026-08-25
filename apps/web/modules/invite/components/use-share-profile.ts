"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import { buildInviteLandingPath, buildShareMessage } from "@/modules/invite/domain/invite-visit"

/**
 * A mecânica de compartilhar o perfil, separada da apresentação.
 *
 * Existe porque a MESMA ação agora aparece em duas formas visuais: o botão da
 * página de perfil (`ShareProfileButton`) e o card de Ações rápidas da Home
 * (`ShareProfileAction`). Duplicar o par Web Share/clipboard nos dois faria
 * duas cópias de uma decisão que precisa continuar idêntica — qual URL é
 * compartilhada, o que acontece quando a pessoa cancela, quanto tempo o
 * "copiado" dura.
 *
 * A URL é sempre a landing PÚBLICA (`/p/<id>`), nunca o Discovery: quem recebe
 * o link provavelmente não tem conta, e `/discover/*` exige sessão — mandaria
 * a pessoa para uma parede de login antes de saber quem a convidou.
 */
export function useShareProfile(professionalId: string, professionalName: string) {
  const [copiado, setCopiado] = useState(false)

  const compartilhar = useCallback(async () => {
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
      // Feedback momentâneo, não permanente.
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error("Não foi possível copiar o link.")
    }
  }, [professionalId, professionalName])

  return { copiado, compartilhar }
}
