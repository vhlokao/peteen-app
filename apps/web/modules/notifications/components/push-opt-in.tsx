"use client"

/**
 * Módulo: notifications
 * Camada: components — opt-in explícito de notificações push.
 *
 * REGRA INEGOCIÁVEL: `Notification.requestPermission()` NUNCA é chamado no load
 * da página. Só a partir do clique no CTA. Um `denied` é permanente no browser
 * — não há segunda chance, nem via UI, nem via código. Pedir cedo demais queima
 * o canal para sempre.
 *
 * Não é Preference Center: no V0, "push ligado" é exatamente "existe
 * subscription ativa". Desinscrever É o desligar — sem segunda fonte de verdade.
 */

import { useCallback, useEffect, useState } from "react"
import { BellRing, BellOff, Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  assinar,
  obterEndpointAtual,
  pushSuportado,
  registrarServiceWorker,
  renegociarSubscription,
} from "@/lib/push/client"
import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "../application/push-actions"

type Estado = "carregando" | "indisponivel" | "desativado" | "ativo" | "negado" | "processando"

type Props = {
  /** NEXT_PUBLIC_VAPID_PUBLIC_KEY — pública por design. Vazia = push desligado. */
  vapidPublicKey: string
}

export function PushOptIn({ vapidPublicKey }: Props) {
  const [estado, setEstado] = useState<Estado>("carregando")
  const [mensagem, setMensagem] = useState<string | null>(null)

  // Só INSPECIONA o estado atual. Nunca pede permissão aqui.
  useEffect(() => {
    let ativo = true
    ;(async () => {
      if (!pushSuportado() || !vapidPublicKey) {
        if (ativo) setEstado("indisponivel")
        return
      }
      if (Notification.permission === "denied") {
        if (ativo) setEstado("negado")
        return
      }
      const endpoint = await obterEndpointAtual()
      if (ativo) setEstado(endpoint ? "ativo" : "desativado")
    })()
    return () => {
      ativo = false
    }
  }, [vapidPublicKey])

  const ativar = useCallback(async () => {
    setEstado("processando")
    setMensagem(null)

    // Permissão — a partir do gesto do usuário, nunca antes.
    const permissao = await Notification.requestPermission()
    if (permissao === "denied") {
      setEstado("negado")
      return
    }
    if (permissao !== "granted") {
      // "default": usuário fechou o prompt. Continua ofertável depois.
      setEstado("desativado")
      return
    }

    const reg = await registrarServiceWorker()
    if (!reg) {
      setEstado("desativado")
      setMensagem("Não foi possível preparar as notificações neste navegador.")
      return
    }

    const sub = await assinar(reg, vapidPublicKey)
    if (!sub) {
      setEstado("desativado")
      setMensagem("Não foi possível ativar as notificações.")
      return
    }

    let resultado = await subscribeToPushAction(sub)

    // ── SUBSCRIPTION_CONFLICT → renegociar e tentar UMA vez ──────────────────
    // Este browser ainda segura a subscription de outro usuário (logout
    // anormal). O servidor não transfere ownership por princípio; quem resolve
    // é o client, descartando a subscription e obtendo um endpoint novo.
    // Exatamente UMA nova tentativa: se falhar de novo, algo mais está errado e
    // insistir viraria laço.
    if (!resultado.success && resultado.code === "SUBSCRIPTION_CONFLICT") {
      const nova = await renegociarSubscription(reg, vapidPublicKey)
      if (nova) {
        resultado = await subscribeToPushAction(nova)
      }
    }

    if (resultado.success) {
      setEstado("ativo")
      return
    }

    setEstado("desativado")
    setMensagem(
      resultado.code === "RATE_LIMIT_DEVICES"
        ? "Você já ativou notificações no número máximo de dispositivos."
        : resultado.code === "RATE_LIMIT_CREATES"
          ? "Muitas tentativas seguidas. Tente novamente mais tarde."
          : resultado.code === "PUSH_DISABLED"
            ? "Notificações indisponíveis no momento."
            : "Não foi possível ativar as notificações."
    )
  }, [vapidPublicKey])

  const desativar = useCallback(async () => {
    setEstado("processando")
    setMensagem(null)

    const endpoint = await obterEndpointAtual()
    if (endpoint) {
      // Servidor primeiro (enquanto há sessão), browser depois.
      await unsubscribeFromPushAction(endpoint)
    }
    const { desinscreverLocalmente } = await import("@/lib/push/client")
    await desinscreverLocalmente()

    setEstado("desativado")
  }, [])

  if (estado === "carregando") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Verificando notificações…
      </div>
    )
  }

  if (estado === "indisponivel") {
    return (
      <p className="text-sm text-muted-foreground">
        Este navegador não suporta notificações push.
      </p>
    )
  }

  if (estado === "negado") {
    return (
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BellOff className="size-4" />
          Notificações bloqueadas neste navegador.
        </p>
        <p className="text-xs text-muted-foreground">
          Para reativar, ajuste a permissão nas configurações do site.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {estado === "ativo" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <Check className="size-4 text-primary" />
            Notificações ativadas neste dispositivo
          </span>
          <Button type="button" variant="outline" size="sm" onClick={desativar}>
            Desativar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={ativar}
          disabled={estado === "processando"}
          className="gap-2"
        >
          {estado === "processando" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BellRing className="size-4" />
          )}
          Ativar notificações
        </Button>
      )}

      {mensagem ? <p className="text-xs text-muted-foreground">{mensagem}</p> : null}
    </div>
  )
}
