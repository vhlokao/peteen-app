"use client"

/**
 * CareTimelineAutoRefresh — atualiza o diário do tutor quando ele VOLTA para a
 * tela. Não renderiza nada.
 *
 * CONTRATO: a Care Timeline continua ASSÍNCRONA. Isto não é live tracking, não
 * é chat e não é polling — não existe nenhum timer aqui. Reage apenas a
 * eventos reais do browser (focus / visibilitychange), exatamente o padrão já
 * usado e validado em `push-opt-in.tsx` para reavaliar permissão de push.
 *
 * O caso que ele resolve: o tutor abre o atendimento, larga o celular, o
 * profissional publica, o tutor volta ao app — e via a mesma tela de antes,
 * porque um Server Component só re-renderiza em navegação. Agora o retorno à
 * aba dispara um `router.refresh()`.
 *
 * O que ele deliberadamente NÃO resolve: tutor parado com a tela aberta não vê
 * a atualização aparecer sozinha. É consequência aceita do contrato assíncrono
 * — quem avisa em tempo de evento é o push (etapa R2), não um socket.
 *
 * Throttle: um par blur/focus rápido (trocar de app e voltar) dispararia dois
 * refreshes em sequência, cada um custando um render de RSC. A janela mínima
 * corta a repetição sem transformar isso em intervalo — sem eventos do
 * usuário, nada acontece.
 */

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const JANELA_MINIMA_MS = 10_000

export function CareTimelineAutoRefresh() {
  const router = useRouter()
  const ultimoRefreshRef = useRef(0)

  useEffect(() => {
    function atualizarSeVoltou() {
      if (document.visibilityState !== "visible") return

      const agora = Date.now()
      if (agora - ultimoRefreshRef.current < JANELA_MINIMA_MS) return
      ultimoRefreshRef.current = agora

      router.refresh()
    }

    window.addEventListener("focus", atualizarSeVoltou)
    document.addEventListener("visibilitychange", atualizarSeVoltou)
    return () => {
      window.removeEventListener("focus", atualizarSeVoltou)
      document.removeEventListener("visibilitychange", atualizarSeVoltou)
    }
  }, [router])

  return null
}
