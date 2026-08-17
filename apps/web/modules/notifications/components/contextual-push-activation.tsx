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
import { BellRing } from "lucide-react"

import { Button } from "@/components/ui/button"
import { avaliarAmbientePush, type EstadoDoAmbientePush } from "@/lib/push/client"
import type { RequestStatus } from "@/modules/service-request/domain/types"
import {
  PUSH_INVITE_DISMISS,
  pushInviteDismissKey,
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

  // Já resolvido: push funcionando neste dispositivo. Nada a oferecer.
  if (ambiente === "ativo") return null

  // Ambiente sem push: silêncio. Mostrar um CTA que falharia é pior que nada,
  // e "não configurado" é problema de operação, não do usuário.
  if (ambiente === "sem-suporte" || ambiente === "nao-configurado") return null

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
                rate limit, iOS, denied — continua sendo do PushOptIn. */}
            <PushOptIn vapidPublicKey={vapidPublicKey} />
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
