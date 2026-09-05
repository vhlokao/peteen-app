"use client"

/**
 * Módulo: notifications
 * Camada: components — opt-in e SAÚDE de notificações push.
 *
 * REGRA INEGOCIÁVEL: `Notification.requestPermission()` NUNCA é chamado no load
 * da página. Só a partir do clique no CTA. Um `denied` é permanente no browser
 * — não há segunda chance, nem via UI, nem via código. Há um teste estrutural
 * (contextual-push-invite.test.ts) que falha se esta chamada sair do handler
 * `ativar`.
 *
 * Não é Preference Center: no V0, "push ligado" é exatamente "existe
 * subscription ativa". Desinscrever É o desligar — sem segunda fonte de verdade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * "ATIVADO" AGORA EXIGE CONCORDÂNCIA DOS DOIS LADOS
 *
 * A versão anterior decidia "ativo" olhando só o browser: se
 * `pushManager.getSubscription()` devolvia algo, mostrava o check verde. Nunca
 * perguntava ao servidor se aquela subscription ainda existia — então uma linha
 * revogada no backend deixava esta tela afirmando "Notificações ativadas" para
 * sempre, enquanto o dispatcher já nem tentava enviar.
 *
 * O veredito passou inteiro para `avaliarSaudePush` (domínio), alimentado pelas
 * DUAS observações. Este componente não decide mais nada sobre saúde — ele
 * renderiza um estado e oferece a ação correspondente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REPARO ANTES DE PEDIR QUALQUER COISA
 *
 * Quando a permissão já está concedida, um estado quebrado é problema NOSSO, não
 * uma decisão pendente do usuário — e é consertado sozinho, sem prompt e sem
 * clique. Só o que o reparo automático não resolve vira botão.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { BellRing, BellOff, Check, Loader2, AlertCircle, Clock, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  avaliarSaudePushNesteDispositivo,
  obterEndpointAtual,
} from "@/lib/push/client"
import { repararPush, type MotivoFalhaReparo } from "@/lib/push/repair"
import { limparOptOutLocal, marcarOptOutLocal } from "@/lib/push/opt-out"
import { resolvePushHealthCopy, type SaudePush } from "../domain/push-health"
import {
  detectarPlataforma,
  type PlataformaNotificacao,
} from "../domain/notification-settings"
import { NotificationSettingsView } from "./notification-settings-view"
import type { PushInvitePersona } from "../domain/contextual-push-invite"
import { unsubscribeFromPushAction } from "../application/push-actions"

/**
 * Fase da INTERAÇÃO, não do ambiente.
 *
 * A saúde do push (ambiente) mora em `SaudePush` e vem do domínio; aqui só
 * vivem os momentos que existem por causa de um clique ou de uma operação em
 * curso. Misturar os dois eixos num enum só foi o que tornava a versão anterior
 * difícil de ler: "ativo" e "carregando" não são o mesmo tipo de coisa.
 */
type Fase =
  | { tipo: "carregando" }
  | { tipo: "pronto"; saude: SaudePush }
  /** Prompt nativo aberto, aguardando decisão do usuário. */
  | { tipo: "solicitando-permissao" }
  /** Criando/reparando subscription. */
  | { tipo: "trabalhando" }
  | { tipo: "erro"; mensagem: string }
  /** Limite atingido. Mensagem própria, sem convidar a novas tentativas. */
  | { tipo: "rate-limited"; mensagem: string }

type Props = {
  /** NEXT_PUBLIC_VAPID_PUBLIC_KEY — pública por design. Vazia = push desligado. */
  vapidPublicKey: string
  /**
   * GATE-10 — quanto contexto o componente desenha ao redor da ação.
   *
   * `inline` (default) é o que sempre existiu: título do estado, detalhe e
   * botão. É o que o convite contextual da Request precisa, porque lá o
   * contexto já está no card que o embrulha.
   *
   * `settings` é a superfície de Conta: rótulo de estado, o que a pessoa
   * recebe e, quando o estado tem saída, o passo a passo real. Opt-in para que
   * a Request não herde um bloco de três passos competindo com o CTA dela.
   */
  apresentacao?: "inline" | "settings"
  /**
   * Só usado em `settings`: a lista do que a pessoa recebe é diferente por
   * persona, porque os eventos enviados são diferentes. Ver
   * `beneficiosDeNotificacao`.
   */
  persona?: PushInvitePersona
  /**
   * Chamado quando o estado observado passa a ser ACTIVE.
   *
   * Existe para o convite contextual conseguir se calar depois de a ativação
   * dar certo. Sem isso, o card da Request ficava com o cabeçalho de convite
   * ("Ative as notificações para…") acompanhado de "✓ Notificações ativadas" e
   * de um botão "Desativar" — três mensagens contraditórias no meio de uma
   * tela operacional.
   */
  aoFicarAtivo?: () => void
}

/** Mensagem para o que o reparo não conseguiu resolver sozinho. */
function mensagemDeFalha(motivo: MotivoFalhaReparo, detalhe?: string): string {
  switch (motivo) {
    case "sem-service-worker":
      return "Não foi possível preparar o serviço de notificações."
    case "falha-assinatura":
      if (detalhe === "chave-invalida" || detalhe === "chave-divergente") {
        return "A configuração de notificações deste ambiente mudou. Recarregue a página e tente de novo."
      }
      if (detalhe === "sem-worker-ativo") {
        return "O serviço de notificações ainda não estava pronto. Tente novamente."
      }
      if (detalhe === "push-serviço-indisponivel") {
        return "O serviço de notificações do navegador não respondeu. Verifique sua conexão e tente de novo."
      }
      return "Não foi possível registrar este dispositivo."
    case "nao-autenticado":
      return "Sua sessão expirou. Entre novamente para ativar as notificações."
    case "rate-limit-devices":
      return "Você já ativou notificações no número máximo de dispositivos."
    case "rate-limit-creates":
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo."
    case "sem-permissao":
    case "push-desabilitado":
    case "interno":
      return "Não foi possível ativar as notificações."
  }
}

export function PushOptIn({
  vapidPublicKey,
  apresentacao = "inline",
  persona = "tutor",
  aoFicarAtivo,
}: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: "carregando" })

  /**
   * Plataforma para a orientação de desbloqueio. `null` até o primeiro efeito:
   * `navigator` não existe no servidor, e a orientação só aparece depois que o
   * estado já foi observado — nunca antes.
   */
  const [plataforma, setPlataforma] = useState<PlataformaNotificacao | null>(null)
  useEffect(() => {
    setPlataforma(detectarPlataforma(navigator.userAgent, navigator.maxTouchPoints))
  }, [])

  /**
   * Em ref, não em dependência: o convite contextual passa uma closure nova a
   * cada render, e depender da identidade dela faria `sincronizar` mudar de
   * identidade a cada render — reavaliando push em loop. Mesmo padrão do
   * `useBackToClose` do visualizador de Momentos.
   */
  const aoFicarAtivoRef = useRef(aoFicarAtivo)
  aoFicarAtivoRef.current = aoFicarAtivo

  /**
   * Trava SÍNCRONA contra double-click. `disabled` depende de re-render, o que
   * deixa uma janela real para um segundo disparo — mesmo padrão já usado no
   * login-form do projeto. Sem isso, cliques repetidos disparavam múltiplos
   * `requestPermission()`, que é justamente o que faz o Chrome/Edge marcar a
   * origem como abusiva e bloquear a permissão automaticamente.
   */
  const emAndamentoRef = useRef(false)

  /**
   * Lê o estado canônico e, se houver algo reparável, conserta em silêncio
   * antes de mostrar qualquer coisa.
   *
   * O reparo acontece ANTES do primeiro render de conteúdo justamente para que
   * a pessoa não veja um aviso de problema que o produto já ia resolver sozinho
   * em 200ms. Só o que sobreviver ao reparo é mostrado.
   */
  const sincronizar = useCallback(async (): Promise<void> => {
    let saude = await avaliarSaudePushNesteDispositivo(vapidPublicKey)

    // Marca obsoleta: push está comprovadamente funcionando apesar de existir
    // um opt-out gravado (desativação que não chegou a concluir). Limpar aqui
    // evita que a marca continue suprimindo o reparo de uma falha futura.
    if (saude.state === "ACTIVE") limparOptOutLocal()

    if (saude.autoReparavel) {
      const resultado = await repararPush(vapidPublicKey)
      if (resultado.ok) {
        saude = await avaliarSaudePushNesteDispositivo(vapidPublicKey)
      } else if (
        resultado.motivo === "rate-limit-devices" ||
        resultado.motivo === "rate-limit-creates"
      ) {
        setFase({ tipo: "rate-limited", mensagem: mensagemDeFalha(resultado.motivo) })
        return
      }
      // Demais falhas: cai no render normal. O estado continuará
      // NEEDS_REPAIR e a tela oferece o botão de reativar — sem inventar uma
      // mensagem de erro para uma tentativa que a pessoa nem sabe que houve.
    }

    // Avisa o embrulho ANTES de renderizar o estado: quem depende disso (o
    // convite contextual) desaparece inteiro, e não deve piscar um "✓ ativadas"
    // no caminho.
    if (saude.state === "ACTIVE") aoFicarAtivoRef.current?.()

    setFase({ tipo: "pronto", saude })
  }, [vapidPublicKey])

  // Avaliação inicial (com reparo silencioso embutido).
  useEffect(() => {
    let vivo = true
    void sincronizar().catch(() => {
      if (vivo) setFase({ tipo: "erro", mensagem: "Não foi possível verificar as notificações." })
    })
    return () => {
      vivo = false
    }
  }, [sincronizar])

  /**
   * Reavalia quando a aba volta ao foco.
   *
   * A permissão pode mudar FORA do Peteen (configurações do navegador), e o
   * browser não emite nenhum evento para a página quando isso acontece. Sem
   * esta reavaliação, o usuário liberava a permissão nas configurações, voltava
   * e via exatamente a mesma tela de antes — parecendo que nada tinha mudado.
   *
   * Aqui NÃO há o freio de tempo que governa o reconciliador global: esta é a
   * tela dedicada ao assunto, aberta de propósito, e quem está olhando para ela
   * espera ver o estado de agora.
   *
   * Reage a eventos reais (focus / visibilitychange), sem polling.
   */
  useEffect(() => {
    const reavaliar = () => {
      if (emAndamentoRef.current) return // não atropela uma operação em curso
      if (document.visibilityState !== "visible") return
      void sincronizar().catch(() => {})
    }
    window.addEventListener("focus", reavaliar)
    document.addEventListener("visibilitychange", reavaliar)
    return () => {
      window.removeEventListener("focus", reavaliar)
      document.removeEventListener("visibilitychange", reavaliar)
    }
  }, [sincronizar])

  const ativar = useCallback(async () => {
    if (emAndamentoRef.current) return // trava síncrona: 1 operação lógica por vez
    emAndamentoRef.current = true

    // Pedir push de volta REVOGA a intenção anterior de não ter push. Limpo
    // antes de qualquer trabalho: se ficasse para depois do sucesso, uma falha
    // no meio deixaria a marca ativa e o reparo automático seguiria suprimido,
    // exatamente quando ele passaria a ser necessário.
    limparOptOutLocal()

    try {
      // Nunca pedir permissão de novo quando já está negada: o browser recusa
      // na hora e chamadas repetidas reforçam a marcação de abuso da origem.
      if (Notification.permission === "denied") {
        await sincronizar()
        return
      }

      let permissao: NotificationPermission = Notification.permission
      if (permissao !== "granted") {
        setFase({ tipo: "solicitando-permissao" })
        permissao = await Notification.requestPermission()
      }

      if (permissao !== "granted") {
        // "denied" ou "default" (prompt dispensado). Nos dois casos o estado
        // canônico já descreve a situação corretamente — não há mensagem a
        // inventar aqui.
        await sincronizar()
        return
      }

      setFase({ tipo: "trabalhando" })
      const resultado = await repararPush(vapidPublicKey)

      if (resultado.ok) {
        await sincronizar()
        return
      }
      if (
        resultado.motivo === "rate-limit-devices" ||
        resultado.motivo === "rate-limit-creates"
      ) {
        setFase({ tipo: "rate-limited", mensagem: mensagemDeFalha(resultado.motivo) })
        return
      }
      setFase({
        tipo: "erro",
        mensagem: mensagemDeFalha(resultado.motivo, resultado.detalhe),
      })
    } catch {
      setFase({ tipo: "erro", mensagem: "Não foi possível ativar as notificações." })
    } finally {
      emAndamentoRef.current = false
    }
  }, [sincronizar, vapidPublicKey])

  const desativar = useCallback(async () => {
    if (emAndamentoRef.current) return
    emAndamentoRef.current = true
    setFase({ tipo: "trabalhando" })

    // ANTES de desligar qualquer coisa. Depois da revogação, o estado técnico
    // fica idêntico ao de um relogin (permissão concedida, sem subscription), e
    // é esta marca — não o estado — que diz que houve intenção. Gravá-la só no
    // fim deixaria uma janela em que o reconciliador global religaria o que
    // acabou de ser desligado.
    marcarOptOutLocal()

    try {
      const endpoint = await obterEndpointAtual()
      if (endpoint) {
        // Servidor primeiro (enquanto há sessão), browser depois.
        await unsubscribeFromPushAction(endpoint)
      }
      const { desinscreverLocalmente } = await import("@/lib/push/client")
      await desinscreverLocalmente()
    } catch {
      // Segue para a releitura: o que a tela mostra vem do estado observado,
      // nunca do que esta função achou que conseguiu fazer.
    }

    emAndamentoRef.current = false

    // Releitura SEM reparo — `sincronizar` repararia, e reparar aqui desfaria
    // a ação que o usuário acabou de pedir. Com a marca gravada acima, o estado
    // canônico deste device é DISABLED/`desativado_pelo_usuario`.
    try {
      const saude = await avaliarSaudePushNesteDispositivo(vapidPublicKey)
      setFase({ tipo: "pronto", saude })
    } catch {
      setFase({ tipo: "erro", mensagem: "Não foi possível verificar as notificações." })
    }
  }, [vapidPublicKey])

  // ── Render ────────────────────────────────────────────────────────────────

  if (fase.tipo === "carregando") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Verificando notificações…
      </p>
    )
  }

  if (fase.tipo === "erro") {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <AlertCircle className="size-4 text-destructive" />
          {fase.mensagem}
        </p>
        <Button type="button" onClick={ativar} className="gap-2">
          <RefreshCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (fase.tipo === "rate-limited") {
    return (
      <p className="flex items-center gap-2 text-sm text-foreground">
        <Clock className="size-4 text-muted-foreground" />
        {fase.mensagem}
      </p>
    )
  }

  const ocupado = fase.tipo === "solicitando-permissao" || fase.tipo === "trabalhando"
  if (ocupado) {
    return (
      <Button type="button" disabled className="gap-2">
        <Loader2 className="size-4 animate-spin" />
        {fase.tipo === "solicitando-permissao"
          ? "Aguardando sua permissão…"
          : "Ativando notificações…"}
      </Button>
    )
  }

  // ── Estado canônico ───────────────────────────────────────────────────────
  // A copy vem do domínio: é a mesma tabela que o teste percorre para garantir
  // que nenhum estado além de ACTIVE afirme que push está funcionando.
  const { saude } = fase
  const copy = resolvePushHealthCopy(saude)

  // ── Superfície de Conta ───────────────────────────────────────────────────
  // A pintura vive em NotificationSettingsView, sem estado próprio: é o que
  // torna os cinco estados inspecionáveis sem precisar visitar cada um deles
  // num navegador real — ver o cabeçalho daquele arquivo.
  if (apresentacao === "settings") {
    return (
      <NotificationSettingsView
        saude={saude}
        plataforma={plataforma}
        persona={persona}
        aoAtivar={ativar}
        aoDesativar={desativar}
      />
    )
  }

  if (saude.state === "ACTIVE") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Check className="size-4 text-primary" />
          {copy.titulo} neste dispositivo
        </span>
        <Button type="button" variant="outline" size="sm" onClick={desativar}>
          Desativar
        </Button>
      </div>
    )
  }

  if (saude.state === "DENIED") {
    return (
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <BellOff className="size-4 text-muted-foreground" />
          {copy.titulo}
        </p>
        {copy.detalhe ? <p className="text-xs text-muted-foreground">{copy.detalhe}</p> : null}
      </div>
    )
  }

  // UNSUPPORTED — nada a oferecer. Um CTA aqui só produziria uma falha
  // garantida, e as três razões (navegador, iOS fora da Tela de Início,
  // ambiente sem VAPID) já têm cada uma o seu texto.
  if (saude.state === "UNSUPPORTED") {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{copy.titulo}</p>
        {copy.detalhe ? <p className="text-xs text-muted-foreground">{copy.detalhe}</p> : null}
      </div>
    )
  }

  // NEEDS_REPAIR e DISABLED — os dois estados acionáveis. O texto do botão
  // muda porque a promessa é diferente: um restabelece algo que existia, o
  // outro liga pela primeira vez.
  const reparando = saude.state === "NEEDS_REPAIR"

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <p className="text-sm text-foreground">{copy.titulo}</p>
        {copy.detalhe ? <p className="text-xs text-muted-foreground">{copy.detalhe}</p> : null}
      </div>
      <Button type="button" onClick={ativar} className="gap-2">
        {reparando ? <RefreshCw className="size-4" /> : <BellRing className="size-4" />}
        {reparando ? "Reativar notificações" : "Ativar notificações"}
      </Button>
    </div>
  )
}
