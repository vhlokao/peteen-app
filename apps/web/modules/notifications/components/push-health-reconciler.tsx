"use client"

/**
 * PushHealthReconciler — reconciliação silenciosa de push.
 *
 * Componente sem render. Montado uma vez no AppShell, portanto presente em toda
 * tela autenticada de tutor e de profissional.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ELE RESOLVE
 *
 * O logout revoga a subscription no servidor E desinscreve no browser — está
 * certo, é uma exigência de segurança. Mas nada nunca a trazia de volta: no
 * login seguinte a permissão continuava `granted` (o browser não a esquece),
 * então o produto não mostrava CTA nenhum, e mesmo assim não havia subscription
 * em lugar nenhum. A pessoa terminava sem push, convencida de que estava tudo
 * certo, e só descobria ao não receber um aviso importante.
 *
 * Cobre também o outro lado do mesmo buraco: subscription local viva com a
 * linha do servidor revogada — o caso que fazia a Conta exibir "ativado" para
 * sempre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TRÊS REGRAS QUE ESTE COMPONENTE NÃO PODE QUEBRAR
 *
 *  1. NUNCA pede permissão. `repararPush` recusa qualquer coisa que não seja
 *     `granted` já concedido, e é lá que a guarda vive — aqui não há sequer
 *     acesso a `requestPermission`.
 *
 *  2. NUNCA renderiza nada. Um reparo automático que pisque um aviso na tela
 *     assustaria por um problema que já está sendo resolvido. Sucesso é
 *     silêncio; falha persistente aparece na Conta, que é o lugar de falar
 *     sobre isso.
 *
 *  3. NUNCA faz polling. Dispara na montagem e no retorno de foco, sempre atrás
 *     do freio de `deveReconciliarAgora`. Não há `setInterval` neste arquivo.
 */

import { useCallback, useEffect, useRef } from "react"

import { avaliarSaudePushNesteDispositivo } from "@/lib/push/client"
import { repararPush } from "@/lib/push/repair"
import { deveReconciliarAgora } from "../domain/push-health"

/**
 * Carimbo da última reconciliação. `sessionStorage` de propósito: um login novo
 * costuma abrir contexto novo, e o comportamento desejado é justamente
 * reconciliar logo no começo de cada sessão de trabalho. Em `localStorage` o
 * carimbo sobreviveria ao logout e engoliria a reconciliação pós-login, que é o
 * momento que mais importa.
 */
const CHAVE_ULTIMA_RECONCILIACAO = "peteen:push-health:ultima"

function lerUltima(): number | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_ULTIMA_RECONCILIACAO)
    if (!bruto) return null
    const n = Number(bruto)
    return Number.isFinite(n) ? n : null
  } catch {
    // Modo privado / storage bloqueado: sem carimbo, reconcilia sempre que o
    // efeito rodar. Aceitável — é barato e nunca vira laço.
    return null
  }
}

function gravarUltima(agora: number): void {
  try {
    window.sessionStorage.setItem(CHAVE_ULTIMA_RECONCILIACAO, String(agora))
  } catch {
    // Ver lerUltima.
  }
}

export function PushHealthReconciler({ vapidPublicKey }: { vapidPublicKey: string }) {
  /**
   * Trava SÍNCRONA de execução única. `focus` e `visibilitychange` disparam
   * juntos ao voltar para a aba; sem esta trava as duas reconciliações
   * correriam em paralelo e poderiam emitir dois `subscribe()` concorrentes
   * para o mesmo device.
   */
  const emAndamentoRef = useRef(false)

  const reconciliar = useCallback(async () => {
    if (!vapidPublicKey) return
    if (emAndamentoRef.current) return

    const agora = Date.now()
    if (!deveReconciliarAgora(lerUltima(), agora)) return

    emAndamentoRef.current = true
    // Carimba ANTES de trabalhar, não depois: se a reconciliação falhar por
    // rede, carimbar só no sucesso faria cada retorno de foco tentar de novo
    // sem freio nenhum — o polling que este componente existe para evitar.
    gravarUltima(agora)

    try {
      const saude = await avaliarSaudePushNesteDispositivo(vapidPublicKey)
      if (!saude.autoReparavel) return

      const resultado = await repararPush(vapidPublicKey)
      if (resultado.ok) {
        console.info("[push] health_reparado", { reason: saude.reason })
      } else {
        // Log e silêncio. A tela da Conta faz o diagnóstico visível quando a
        // pessoa for olhar; interromper o que ela está fazendo agora, por um
        // canal auxiliar, seria desproporcional.
        console.warn("[push] health_reparo_falhou", {
          reason: saude.reason,
          motivo: resultado.motivo,
        })
      }
    } catch {
      // Best-effort absoluto: reconciliação de push jamais pode derrubar uma
      // tela de produto.
    } finally {
      emAndamentoRef.current = false
    }
  }, [vapidPublicKey])

  // Montagem — cobre o primeiro carregamento após login/relogin.
  useEffect(() => {
    void reconciliar()
  }, [reconciliar])

  // Retorno ao app depois de um tempo. O freio decide se vale; aqui só
  // reagimos a eventos reais do browser, nunca a um timer.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return
      void reconciliar()
    }
    window.addEventListener("focus", aoVoltar)
    document.addEventListener("visibilitychange", aoVoltar)
    return () => {
      window.removeEventListener("focus", aoVoltar)
      document.removeEventListener("visibilitychange", aoVoltar)
    }
  }, [reconciliar])

  return null
}
