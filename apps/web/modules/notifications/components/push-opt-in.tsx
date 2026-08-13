"use client"

/**
 * Módulo: notifications
 * Camada: components — opt-in explícito de notificações push.
 *
 * REGRA INEGOCIÁVEL: `Notification.requestPermission()` NUNCA é chamado no load
 * da página. Só a partir do clique no CTA. Um `denied` é permanente no browser
 * — não há segunda chance, nem via UI, nem via código.
 *
 * Não é Preference Center: no V0, "push ligado" é exatamente "existe
 * subscription ativa". Desinscrever É o desligar — sem segunda fonte de verdade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PERMISSÃO ≠ PUSH ATIVO
 *
 * `Notification.permission === "granted"` sozinho NÃO significa que push está
 * funcionando. "Ativo" exige TODAS estas condições:
 *   1. APIs suportadas (SW + PushManager + Notification)
 *   2. VAPID configurada no ambiente
 *   3. permission === "granted"
 *   4. Service Worker ATIVO
 *   5. PushSubscription válida no browser
 *   6. subscription aceita e registrada pelo servidor
 *
 * Tratar (3) como suficiente era o motivo de o estado "voltar ao início" depois
 * que o usuário liberava a permissão manualmente: a permissão estava concedida,
 * mas a subscription nunca fora criada, e a UI mostrava o mesmo CTA de antes
 * sem explicar que faltava um passo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { BellRing, BellOff, Check, Loader2, AlertCircle, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  assinar,
  iosForaDaTelaDeInicio,
  obterEndpointAtual,
  pushSuportado,
  registrarServiceWorker,
  renegociarSubscription,
} from "@/lib/push/client"
import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "../application/push-actions"

/**
 * Cada causa distinta tem seu próprio estado. Reaproveitar um estado para
 * causas diferentes foi exatamente o que tornou o problema indiagnosticável:
 * "sem suporte", "sem VAPID" e "falhou ao assinar" produziam telas
 * indistinguíveis (ou nenhuma mudança visível).
 */
type Estado =
  /** Inspecionando o ambiente no mount. Nunca pede permissão. */
  | "carregando"
  /** O BROWSER não tem as APIs (ou contexto inseguro). Nada a fazer. */
  | "sem-suporte"
  /** iOS/iPadOS compatível (16.4+), mas rodando fora da Tela de Início — a API
   *  só é exposta em modo standalone. Distinto de "sem-suporte": aqui existe
   *  uma ação real que o usuário pode tomar. */
  | "ios-fora-da-tela-inicio"
  /** O AMBIENTE não tem NEXT_PUBLIC_VAPID_PUBLIC_KEY. Problema de config. */
  | "nao-configurado"
  /** permission === "default": nunca perguntamos. CTA principal. */
  | "desativado"
  /** Prompt nativo aberto, aguardando decisão do usuário. */
  | "solicitando-permissao"
  /** Permissão concedida; criando SW + subscription + registro no servidor. */
  | "criando-subscription"
  /** permission === "granted" mas SEM subscription. Falta um passo — e o
   *  usuário precisa saber disso, não ver o mesmo botão inicial. */
  | "permitido-sem-subscription"
  /** Tudo pronto e confirmado pelo servidor. */
  | "ativo"
  /** permission === "denied". NUNCA chamar o backend neste estado. */
  | "negado"
  /** Falha recuperável — oferece tentar de novo. */
  | "erro"
  /** Limite atingido. Mensagem própria, sem spam de novas tentativas. */
  | "rate-limited"

type Props = {
  /** NEXT_PUBLIC_VAPID_PUBLIC_KEY — pública por design. Vazia = push desligado. */
  vapidPublicKey: string
}

export function PushOptIn({ vapidPublicKey }: Props) {
  const [estado, setEstado] = useState<Estado>("carregando")
  const [detalhe, setDetalhe] = useState<string | null>(null)

  /**
   * Trava SÍNCRONA contra double-click. `disabled` depende de re-render, o que
   * deixa uma janela real para um segundo disparo — mesmo padrão já usado no
   * login-form do projeto. Sem isso, cliques repetidos disparavam múltiplos
   * `requestPermission()`, que é justamente o que faz o Chrome/Edge marcar a
   * origem como abusiva e bloquear a permissão automaticamente.
   */
  const emAndamentoRef = useRef(false)

  /** Avalia o estado real do ambiente. Só observa — nunca pede permissão. */
  const avaliar = useCallback(async (): Promise<Estado> => {
    if (!pushSuportado()) {
      return iosForaDaTelaDeInicio() ? "ios-fora-da-tela-inicio" : "sem-suporte"
    }
    if (!vapidPublicKey) return "nao-configurado"

    const permissao = Notification.permission
    if (permissao === "denied") return "negado"

    const endpoint = await obterEndpointAtual()
    if (endpoint) return "ativo"

    // Permissão já concedida, mas sem subscription: falta um passo explícito.
    if (permissao === "granted") return "permitido-sem-subscription"
    return "desativado"
  }, [vapidPublicKey])

  // Avaliação inicial.
  useEffect(() => {
    let vivo = true
    void avaliar().then((e) => {
      if (vivo) setEstado(e)
    })
    return () => {
      vivo = false
    }
  }, [avaliar])

  /**
   * Reavalia quando a aba volta ao foco.
   *
   * A permissão pode mudar FORA do Peteen (configurações do navegador), e o
   * browser não emite nenhum evento para a página quando isso acontece. Sem
   * esta reavaliação, o usuário liberava a permissão nas configurações, voltava
   * e via exatamente a mesma tela de antes — parecendo que nada tinha mudado.
   *
   * Reage a eventos reais (focus / visibilitychange), sem polling. Nunca
   * dispara pedido de permissão nem cria subscription sozinho: apenas atualiza
   * o que está sendo mostrado.
   */
  useEffect(() => {
    const reavaliar = () => {
      if (emAndamentoRef.current) return // não atropela uma operação em curso
      if (document.visibilityState !== "visible") return
      void avaliar().then((novo) => {
        setEstado(novo)
        // Limpa a mensagem auxiliar junto com o estado. Sem isso, o texto de um
        // estado anterior sobrevivia à transição e aparecia contradizendo o novo
        // — ex.: "Permissão concedida…" junto de "Você ainda não permitiu…".
        setDetalhe(null)
      })
    }
    window.addEventListener("focus", reavaliar)
    document.addEventListener("visibilitychange", reavaliar)
    return () => {
      window.removeEventListener("focus", reavaliar)
      document.removeEventListener("visibilitychange", reavaliar)
    }
  }, [avaliar])

  /** Cria SW + subscription + registra no servidor. Assume permission granted. */
  const criarSubscription = useCallback(async (): Promise<Estado> => {
    const reg = await registrarServiceWorker()
    if (!reg) {
      setDetalhe("Não foi possível preparar o serviço de notificações.")
      return "erro"
    }

    let assinatura = await assinar(reg, vapidPublicKey)
    if (!assinatura.ok) {
      setDetalhe(
        assinatura.motivo === "chave-invalida" || assinatura.motivo === "chave-divergente"
          ? "A configuração de notificações deste ambiente mudou. Recarregue a página e tente de novo."
          : assinatura.motivo === "sem-worker-ativo"
            ? "O serviço de notificações ainda não estava pronto. Tente novamente."
            : assinatura.motivo === "push-serviço-indisponivel"
              ? "O serviço de notificações do navegador não respondeu. Verifique sua conexão e tente de novo."
              : "Não foi possível registrar este dispositivo."
      )
      return "erro"
    }

    let resultado = await subscribeToPushAction(assinatura.subscription)

    // SUBSCRIPTION_CONFLICT → renegociar e tentar EXATAMENTE uma vez.
    if (!resultado.success && resultado.code === "SUBSCRIPTION_CONFLICT") {
      const nova = await renegociarSubscription(reg, vapidPublicKey)
      if (nova.ok) {
        assinatura = nova
        resultado = await subscribeToPushAction(nova.subscription)
      }
    }

    if (resultado.success) {
      setDetalhe(null)
      return "ativo"
    }

    if (resultado.code === "RATE_LIMIT_DEVICES") {
      setDetalhe("Você já ativou notificações no número máximo de dispositivos.")
      return "rate-limited"
    }
    if (resultado.code === "RATE_LIMIT_CREATES") {
      setDetalhe("Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.")
      return "rate-limited"
    }
    if (resultado.code === "PUSH_DISABLED") {
      return "nao-configurado"
    }
    if (resultado.code === "UNAUTHENTICATED") {
      setDetalhe("Sua sessão expirou. Entre novamente para ativar as notificações.")
      return "erro"
    }
    setDetalhe("Não foi possível ativar as notificações.")
    return "erro"
  }, [vapidPublicKey])

  const ativar = useCallback(async () => {
    if (emAndamentoRef.current) return // trava síncrona: 1 operação lógica por vez
    emAndamentoRef.current = true
    setDetalhe(null)

    try {
      // Nunca pedir permissão de novo quando já está negada: o browser recusa
      // na hora e chamadas repetidas reforçam a marcação de abuso da origem.
      if (Notification.permission === "denied") {
        setEstado("negado")
        return
      }

      let permissao: NotificationPermission = Notification.permission
      if (permissao !== "granted") {
        setEstado("solicitando-permissao")
        permissao = await Notification.requestPermission()
      }

      if (permissao === "denied") {
        setEstado("negado")
        return
      }
      if (permissao !== "granted") {
        // "default": o usuário fechou/dispensou o prompt. Continua ofertável.
        setEstado("desativado")
        setDetalhe("Você ainda não permitiu as notificações neste navegador.")
        return
      }

      setEstado("criando-subscription")
      setEstado(await criarSubscription())
    } catch {
      setDetalhe("Não foi possível ativar as notificações.")
      setEstado("erro")
    } finally {
      emAndamentoRef.current = false
    }
  }, [criarSubscription])

  const desativar = useCallback(async () => {
    if (emAndamentoRef.current) return
    emAndamentoRef.current = true
    setEstado("criando-subscription")
    setDetalhe(null)
    try {
      const endpoint = await obterEndpointAtual()
      if (endpoint) {
        // Servidor primeiro (enquanto há sessão), browser depois.
        await unsubscribeFromPushAction(endpoint)
      }
      const { desinscreverLocalmente } = await import("@/lib/push/client")
      await desinscreverLocalmente()
      setEstado(await avaliar())
    } catch {
      setEstado(await avaliar())
    } finally {
      emAndamentoRef.current = false
    }
  }, [avaliar])

  // ── Render ────────────────────────────────────────────────────────────────

  if (estado === "carregando") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Verificando notificações…
      </p>
    )
  }

  if (estado === "sem-suporte") {
    return (
      <p className="text-sm text-muted-foreground">
        Este navegador não suporta notificações push.
      </p>
    )
  }

  if (estado === "ios-fora-da-tela-inicio") {
    return (
      <p className="text-sm text-muted-foreground">
        Para receber notificações no iPhone, adicione o Peteen à Tela de Início
        e abra por lá.
      </p>
    )
  }

  if (estado === "nao-configurado") {
    return (
      <p className="text-sm text-muted-foreground">
        Notificações push não estão configuradas neste ambiente.
      </p>
    )
  }

  if (estado === "negado") {
    return (
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <BellOff className="size-4 text-muted-foreground" />
          Notificações bloqueadas no navegador.
        </p>
        <p className="text-xs text-muted-foreground">
          Libere as notificações para este site nas configurações do navegador. A
          página se atualiza sozinha quando você voltar.
        </p>
      </div>
    )
  }

  if (estado === "ativo") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Check className="size-4 text-primary" />
            Notificações ativadas neste dispositivo
          </span>
          <Button type="button" variant="outline" size="sm" onClick={desativar}>
            Desativar
          </Button>
        </div>
      </div>
    )
  }

  const ocupado = estado === "solicitando-permissao" || estado === "criando-subscription"

  return (
    <div className="space-y-2">
      {estado === "permitido-sem-subscription" ? (
        <p className="text-sm text-foreground">
          Permissão concedida. Falta ativar as notificações neste dispositivo.
        </p>
      ) : estado === "erro" ? (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <AlertCircle className="size-4 text-destructive" />
          {detalhe ?? "Não foi possível ativar as notificações."}
        </p>
      ) : estado === "rate-limited" ? (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Clock className="size-4 text-muted-foreground" />
          {detalhe}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Receba avisos importantes sobre suas solicitações.
        </p>
      )}

      {estado !== "rate-limited" && (
        <Button type="button" onClick={ativar} disabled={ocupado} className="gap-2">
          {ocupado ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BellRing className="size-4" />
          )}
          {estado === "solicitando-permissao"
            ? "Aguardando sua permissão…"
            : estado === "criando-subscription"
              ? "Ativando notificações…"
              : estado === "erro"
                ? "Tentar novamente"
                : estado === "permitido-sem-subscription"
                  ? "Concluir ativação"
                  : "Ativar notificações"}
        </Button>
      )}

      {detalhe && estado !== "erro" && estado !== "rate-limited" ? (
        <p className="text-xs text-muted-foreground">{detalhe}</p>
      ) : null}
    </div>
  )
}
