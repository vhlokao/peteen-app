"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import { buildInviteLandingPath, INVITE_SHARE_MESSAGE } from "@/modules/invite/domain/invite-visit"

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
 *
 * Só recebe o ID: a mensagem é em primeira pessoa e não interpola nome. Havia
 * um `professionalName` aqui que nunca chegou a ser usado — mantê-lo sugeriria
 * que o nome aparece no que é enviado, e não aparece.
 */
export function useShareProfile(professionalId: string) {
  const [copiado, setCopiado] = useState(false)

  const compartilhar = useCallback(async () => {
    // `window.location.origin` em vez de env var: funciona igual em preview,
    // produção e local, sem depender de configuração correta por ambiente.
    const url = `${window.location.origin}${buildInviteLandingPath(professionalId)}`

    if (navigator.share) {
      try {
        // `text` e `url` são campos SEPARADOS de propósito — a mensagem não
        // embute o endereço. O WhatsApp concatena os dois, e quando o link
        // estava nos dois lugares ele aparecia duplicado na conversa.
        await navigator.share({ title: "Meu perfil na Peteen", text: INVITE_SHARE_MESSAGE, url })
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
  }, [professionalId])

  return { copiado, compartilhar }
}
