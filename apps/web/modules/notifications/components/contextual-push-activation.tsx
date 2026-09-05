"use client"

/**
 * ContextualPushActivation — convida a ativar notificações no momento em que o
 * benefício é evidente (Care Operations V0 — R2B.5).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE COMPONENTE **NÃO** FAZ
 *
 * Ele não cria subscription, não conhece VAPID, não fala com a API e não sabe
 * o que é rate limit. Toda a ativação continua sendo `PushOptIn`, embrulhado
 * aqui dentro — reescrever esse fluxo criaria uma segunda porta para
 * `Notification.requestPermission()`, e é justamente essa chamada que não pode
 * ter duas implementações: um `denied` é permanente no browser.
 *
 * O que ele acrescenta é só o que faltava: DECIDIR SE VALE PERGUNTAR AGORA e
 * explicar POR QUÊ antes de qualquer gesto.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NENHUMA PERMISSÃO É PEDIDA NO MOUNT
 *
 * A avaliação inicial só OBSERVA o ambiente (`avaliarAmbientePush`). O prompt
 * nativo só existe dentro do `onClick` do `PushOptIn`. Isso é verificado por
 * teste de regressão — ver contextual-push-invite.test.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HIERARQUIA VISUAL (item 10 da missão)
 *
 * O card é deliberadamente discreto: fundo `muted`, sem borda colorida, título
 * em tamanho de corpo. Ele NUNCA pode competir com "Concluir atendimento",
 * "Avaliar atendimento" ou "Atualizar diário" — a ação operacional é o que a
 * pessoa veio fazer; notificação é conveniência.
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BellOff, BellRing } from "lucide-react"

import { Button } from "@/components/ui/button"
import { avaliarAmbientePush, type EstadoDoAmbientePush } from "@/lib/push/client"
import type { RequestStatus } from "@/modules/service-request/domain/types"
import {
  contaHrefDaPersona,
  PUSH_INVITE_DISMISS,
  pushInviteDismissKey,
  resolveContextualInviteMode,
  resolveContextualOrientacao,
  resolvePushInviteCopy,
  type PushInvitePersona,
} from "../domain/contextual-push-invite"
import { PushOptIn } from "./push-opt-in"

type Props = {
  persona: PushInvitePersona
  requestId: string
  status: RequestStatus
  /** NEXT_PUBLIC_VAPID_PUBLIC_KEY, lida no servidor e passada como prop. */
  vapidPublicKey: string
}

export function ContextualPushActivation({
  persona,
  requestId,
  status,
  vapidPublicKey,
}: Props) {
  // `null` = ainda observando. Nada é renderizado até saber: um card que
  // aparece e some no primeiro frame é pior que um card que demora.
  const [ambiente, setAmbiente] = useState<EstadoDoAmbientePush | null>(null)
  const [dispensado, setDispensado] = useState(false)

  /**
   * A ativação deu certo enquanto este card estava aberto.
   *
   * `ambiente` é uma fotografia do mount e não se atualiza sozinha — sem este
   * sinal, o card continuava com o cabeçalho de convite ("Ative as notificações
   * para saber quando o profissional responder") logo acima de um "✓
   * Notificações ativadas neste dispositivo" e de um botão "Desativar". Três
   * mensagens contraditórias no meio de uma tela operacional.
   */
  const [ficouAtivo, setFicouAtivo] = useState(false)
  const marcarAtivo = useCallback(() => setFicouAtivo(true), [])

  const copy = resolvePushInviteCopy(persona, status)
  const chaveDeDispensa = pushInviteDismissKey(persona, requestId, status)

  // Dispensa: lida ANTES de qualquer render do card, para não piscar.
  useEffect(() => {
    try {
      setDispensado(window.sessionStorage.getItem(chaveDeDispensa) === "1")
    } catch {
      // sessionStorage indisponível (modo privado, iframe): o convite
      // simplesmente não guarda dispensa. Nunca impede o fluxo.
    }
  }, [chaveDeDispensa])

  // Só OBSERVA o ambiente — nunca pede permissão. Ver o cabeçalho.
  useEffect(() => {
    if (!copy) return
    let vivo = true
    void avaliarAmbientePush(vapidPublicKey).then((e) => {
      if (vivo) setAmbiente(e)
    })
    return () => {
      vivo = false
    }
  }, [copy, vapidPublicKey])

  const dispensar = useCallback(() => {
    setDispensado(true)
    try {
      window.sessionStorage.setItem(chaveDeDispensa, "1")
    } catch {
      // Sem storage a dispensa vale só para esta montagem — aceitável: o
      // objetivo é não obstruir, não construir preferência permanente.
    }
  }, [chaveDeDispensa])

  // ── Portões de exibição ───────────────────────────────────────────────────
  // Momento sem benefício real (estado terminal, por exemplo).
  if (!copy) return null
  if (dispensado) return null
  if (ambiente === null) return null
  // Ativou agora, aqui dentro. O card sai de cena em vez de virar painel de
  // controle de notificações no meio da Request.
  if (ficouAtivo) return null

  // GATE-10 — o QUE mostrar passou a ser decisão do domínio. O portão anterior
  // era uma lista de `if`s no componente, e foi por isso que `negado` e
  // `ios-fora-da-tela-inicio` caíram no caminho do convite: eles não estavam
  // em nenhuma das listas de silêncio, então herdavam por omissão um cabeçalho
  // que prometia exatamente o que aqueles estados proíbem.
  const modo = resolveContextualInviteMode(ambiente)

  if (modo === "silenciar") return null

  // ── Orientar: sem promessa, sem CTA, uma linha ────────────────────────────
  // Bloqueado ou iOS fora da Tela de Início. Há um caminho real, mas ele não
  // começa aqui — e repetir os três passos dentro da Request competiria com a
  // ação que a pessoa veio executar.
  if (modo === "orientar") {
    const orientacao = resolveContextualOrientacao(ambiente)
    if (!orientacao) return null

    return (
      <section className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
        <BellOff aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          {orientacao.texto}{" "}
          <Link
            href={contaHrefDaPersona(persona)}
            className="font-medium text-foreground underline underline-offset-2"
          >
            {orientacao.acao}
          </Link>
        </p>
        {/* Mesma dispensa do convite: quem já sabe que bloqueou não precisa
            reler o aviso em cada visita à Request. */}
        <button
          type="button"
          onClick={dispensar}
          className="-my-1 shrink-0 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Ocultar
        </button>
      </section>
    )
  }

  return (
    <section
      aria-labelledby={`push-invite-${requestId}`}
      className="rounded-2xl border border-border/70 bg-muted/30 p-4"
    >
      <div className="flex gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground"
        >
          <BellRing className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p id={`push-invite-${requestId}`} className="text-sm font-medium text-foreground">
            {copy.title}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{copy.description}</p>

          <div className="mt-3">
            {/* Toda a ativação — permissão, service worker, subscription,
                rate limit, iOS, denied — continua sendo do PushOptIn.
                `apresentacao` fica no default `inline`: o bloco de passos da
                superfície de Conta competiria com o CTA da Request. */}
            <PushOptIn vapidPublicKey={vapidPublicKey} aoFicarAtivo={marcarAtivo} />
          </div>

          {/* Dispensa discreta: botão real (não um "x" decorativo), com alvo
              de toque adequado. O card não pode virar obstáculo. */}
          <Button
            type="button"
            variant="ghost"
            onClick={dispensar}
            className="mt-1 h-11 px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {PUSH_INVITE_DISMISS}
          </Button>
        </div>
      </div>
    </section>
  )
}
