"use client"

import { useEffect, useRef } from "react"

/**
 * Registra a visita à landing de convite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UM COMPONENTE DE CLIENTE PARA UM EFEITO DE SERVIDOR
 *
 * O registro precisa EMITIR o cookie do visitante quando ele ainda não
 * existe, e um Server Component de página não pode escrever cookies no Next
 * — só Server Actions e Route Handlers podem. Este componente não renderiza
 * nada: só dispara um POST para o Route Handler, que emite o cookie e grava a
 * visita.
 *
 * NÃO BLOQUEIA NEM ATRASA A PÁGINA: roda depois da hidratação, e uma falha é
 * ignorada em silêncio. A landing é útil mesmo se a medição não acontecer —
 * e continuará útil enquanto a tabela `invite_visits` não existir no banco.
 *
 * O guard de `useRef` evita o disparo duplo do StrictMode em
 * desenvolvimento. A idempotência real, no entanto, é do servidor (índice
 * único + janela de dedupe) — este guard é conforto, não garantia.
 */
export function InviteVisitTracker({ professionalId }: { professionalId: string }) {
  const jaRegistrou = useRef(false)

  useEffect(() => {
    if (jaRegistrou.current) return
    jaRegistrou.current = true

    fetch("/api/invite/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professionalId }),
      // Mantém o cookie first-party na requisição e permite ao servidor
      // emiti-lo na resposta.
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {
      // Medição é secundária — nunca vira erro visível para quem só queria
      // ver o perfil de quem o convidou.
    })
  }, [professionalId])

  return null
}
