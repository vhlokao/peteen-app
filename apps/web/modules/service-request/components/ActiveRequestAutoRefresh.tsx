"use client"

/**
 * ActiveRequestAutoRefresh — mantém a tela de detalhe de uma Request ativa
 * sincronizada com o backend sem exigir reload manual (Care Operations V0 —
 * R2B.2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA REAL QUE ISTO RESOLVE
 *
 * Um tutor real permaneceu na tela de detalhe enquanto o profissional aceitou,
 * iniciou e concluiu o atendimento. A página é um Server Component — sem
 * navegação nova, ela não tem por que saber que o status mudou. O tutor via
 * "Aguardando resposta" muito depois de já estar em andamento.
 *
 * `CareTimelineAutoRefresh` (R0) resolve um problema parecido, mas só no
 * Diário e só com focus/visibility, sem timer — porque o Diário é lido sob
 * demanda, não é a tela em que a pessoa fica parada esperando o próximo
 * evento do CONTRATO (aceite, início, conclusão). Aqui, sim: por isso este
 * componente soma um timer de 20s aos mesmos eventos de foco/visibilidade,
 * mas só enquanto a Request está num estado que pode mudar por ação de
 * outra pessoa.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE COMPONENTE FAZ E O QUE ELE DELEGA
 *
 * Toda a DECISÃO vive em `modules/service-request/domain/active-request-sync.ts`,
 * pura e testada sem DOM. Este arquivo só:
 *   1. observa o estado real do browser (visibilidade, foco, o registro de
 *      interações locais abaixo);
 *   2. chama `shouldSync` a cada gatilho para saber se vale CONSULTAR o
 *      backend agora;
 *   3. se sim, chama `getRequestSyncProbeAction` — uma leitura leve e
 *      autorizada que devolve só um token comparável, não o detalhe
 *      completo;
 *   4. chama `shouldRefreshAfterProbe` comparando o token novo com o
 *      anterior; só ENTÃO, se for diferente, dispara `router.refresh()`.
 *
 * NUNCA chama `router.refresh()` diretamente a partir de um timer/foco sem
 * antes confirmar via probe que algo realmente mudou — motivo do
 * `getRequestSyncProbeAction` existir: um `router.refresh()` cego a cada
 * ciclo funciona, mas gera tráfego RSC completo mesmo quando nada mudou, e
 * se a rede cair no meio de um refresh (não de um probe), o Next cai para
 * navegação completa do browser — o que derruba a página. Um probe que falha
 * só é ignorado; nunca decide sincronizar sem confirmação.
 *
 * O TIMER EM SI só existe enquanto `shouldRunPollTimer(status, visible)` for
 * verdadeiro — por isso `visible` é estado de componente (não só uma leitura
 * pontual de `document.visibilityState`): sem re-render na troca de aba, o
 * effect que cria o `setInterval` nunca saberia que precisa se recriar (ou
 * parar), e o timer continuaria vivo em background.
 *
 * FOCO/VISIBILIDADE FUNCIONAM MESMO EM STATUS TERMINAL — só o timer respeita
 * o gate de status. Dados relacionados (disputa, review, Diário) podem mudar
 * sem nenhuma transição de `ServiceRequest.status`; uma review chegando
 * depois de COMPLETED só aparece se foco/visibilidade continuarem ativos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGISTRO DE INTERAÇÃO — POR QUE UM CONTEXT LOCAL, NÃO STATE GLOBAL
 *
 * Um `router.refresh()` não pode apagar o rating que o tutor está escolhendo
 * no ReviewForm, nem o texto que está digitando numa disputa. A defesa fica
 * num Context criado e consumido só dentro desta árvore — nasce e morre com
 * a página de detalhe, não é um store global do app. Qualquer formulário na
 * árvore chama `useSuspendAutoRefreshWhileEditing(true)` enquanto tiver
 * conteúdo não salvo; enquanto qualquer um estiver registrado, nenhuma
 * sincronização acontece. Fora desta árvore (ou se o Provider não existir),
 * o hook não faz nada — nunca lança.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"

import {
  shouldSyncGeneric,
  isRequestSyncActive,
  shouldRefreshAfterProbe,
  ACTIVE_REQUEST_POLL_INTERVAL_MS,
  REQUEST_OPERATIONAL_POLL_INTERVAL_MS,
  type ActiveRequestSyncTrigger,
} from "../domain/active-request-sync"
import {
  getRequestSyncProbeAction,
  getTutorRequestListSyncProbeAction,
  getProfessionalRequestListSyncProbeAction,
} from "../application/actions"
import type { RequestStatus, ActionResult } from "../domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// Registro de interação
// ─────────────────────────────────────────────────────────────────────────────

type InteractionRegistry = {
  setInteracting: (id: string, interacting: boolean) => void
}

const InteractionContext = createContext<InteractionRegistry | null>(null)

/**
 * Formulários chamam isto para suspender o auto-sync enquanto têm conteúdo
 * não salvo. `interacting` normalmente é uma expressão como
 * `rating > 0 || comment.trim().length > 0`, não um booleano fixo.
 *
 * Sem Provider na árvore (ex.: usado fora de uma página de detalhe), é no-op
 * — nunca lança, nunca exige que o chamador saiba se está dentro do contexto.
 */
export function useSuspendAutoRefreshWhileEditing(interacting: boolean): void {
  const registry = useContext(InteractionContext)
  const id = useId()

  useEffect(() => {
    registry?.setInteracting(id, interacting)
    return () => registry?.setInteracting(id, false)
  }, [registry, id, interacting])
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor compartilhado — timer + foco/visibilidade + probe + refresh
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toda a "fiação" de sincronização (item 9 da missão REQUEST AUTO-SYNC
 * RELIABILITY: reutilizar o componente canônico, nunca duplicar um segundo
 * polling paralelo). `ActiveRequestAutoRefresh` (detalhe de UMA Request) e
 * `RequestListAutoRefresh` (lista do tutor/profissional) são as duas únicas
 * diferenças entre eles: QUEM decide se o timer deve rodar
 * (`intervalActive`) e QUAL probe chamar — o resto (visibilidade, foco,
 * cooldown, guard de rajada, comparação de token, `router.refresh()`) é
 * exatamente o mesmo código, uma vez só.
 */
function useRequestSyncEngine({
  intervalActive,
  pollIntervalMs,
  initialToken,
  probe,
}: {
  /** Recalculado pelo CHAMADOR a cada render — decide se o timer existe agora. */
  intervalActive: boolean
  pollIntervalMs: number
  initialToken: string | null
  probe: () => Promise<ActionResult<{ token: string }>>
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Otimista (true) porque `document` não existe durante SSR — corrigido no
  // primeiro effect após montar, e mantido correto dali em diante pelo
  // listener de visibilitychange. Nunca dispara refresh no mount só por
  // "descobrir" a visibilidade real: o servidor já mandou dado fresco.
  const [visible, setVisible] = useState(true)

  // Conjunto de ids interagindo agora. Ref, não state: registrar uma tecla
  // digitada não pode re-renderizar a árvore inteira.
  const interactingIdsRef = useRef<Set<string>>(new Set())
  const setInteracting = useCallback((id: string, interacting: boolean) => {
    if (interacting) interactingIdsRef.current.add(id)
    else interactingIdsRef.current.delete(id)
  }, [])

  const lastAttemptAtRef = useRef<number | null>(null)
  // Guard SÍNCRONO contra rajada — o probe é uma Promise, e dois eventos no
  // mesmo tick (focus + visibilitychange) poderiam ambos ler isRefreshing
  // como livre e disparar dois probes concorrentes antes do primeiro
  // resolver. Liberado no `finally` do probe, não em `isPending` de
  // useTransition — o probe em si nunca é uma transição (é só um fetch), só
  // o eventual `router.refresh()`, no fim da cadeia, é.
  const isRefreshingRef = useRef(false)

  // Token do último probe bem-sucedido — referência para a PRÓXIMA
  // comparação. Seedado com `initialToken` (do SSR), NUNCA com `null` — sem
  // isto, o PRIMEIRO probe (que pode acontecer bem depois do mount: sem
  // timer, só foco/visibilidade) trataria qualquer coisa que já tivesse
  // mudado entre o SSR e esse primeiro probe como "estado inicial",
  // engolindo a mudança sem nunca sincronizar. Achado ao vivo do hardening:
  // disputa criada externamente, sem nenhum probe rodar por 104s, o primeiro
  // foco manual absorveu a disputa como baseline em vez de detectá-la como
  // diferença. Quem calcula o token inicial no servidor usa a MESMA função
  // de token do cliente, garantindo que o primeiro probe comece comparando
  // contra o que a tela já mostra, não contra nada.
  const lastTokenRef = useRef<string | null>(initialToken)

  const intervalActiveRef = useRef(intervalActive)
  intervalActiveRef.current = intervalActive

  const probeRef = useRef(probe)
  probeRef.current = probe

  const attempt = useCallback(
    (trigger: ActiveRequestSyncTrigger) => {
      const now = Date.now()
      const deve = shouldSyncGeneric(
        trigger,
        {
          intervalActive: intervalActiveRef.current,
          documentVisible: document.visibilityState === "visible",
          hasInteraction: interactingIdsRef.current.size > 0,
          isRefreshing: isRefreshingRef.current,
          lastAttemptAt: lastAttemptAtRef.current,
        },
        now
      )
      if (!deve) return

      lastAttemptAtRef.current = now
      isRefreshingRef.current = true

      probeRef
        .current()
        .then((result) => {
          // Probe falhou (erro de negócio/autorização, não exceção) — não
          // sincroniza, não mexe na referência, não deixa rastro visível.
          // O próximo ciclo (timer, foco ou visibilidade) tenta de novo.
          if (!result.success) return

          const novoToken = result.data.token
          if (shouldRefreshAfterProbe(lastTokenRef.current, novoToken)) {
            lastTokenRef.current = novoToken
            startTransition(() => {
              router.refresh()
            })
          } else {
            lastTokenRef.current = novoToken
          }
        })
        .catch((err) => {
          // Falha de rede/transporte no probe (não no refresh — o probe é
          // um fetch normal de Server Action, não sofre o fallback de
          // navegação completa que router.refresh() sofre quando falha).
          // Mesma postura: estado atual preservado, sem toast, próximo
          // ciclo tenta de novo.
          console.error("[active-request-sync] probe_failed", {
            erro: String(err).slice(0, 120),
          })
        })
        .finally(() => {
          isRefreshingRef.current = false
        })
    },
    [router, startTransition]
  )

  // Visibilidade — única fonte que corrige `visible` após o mount e a cada
  // troca de aba/app. Recuperar visibilidade dispara uma tentativa de
  // sincronização (gatilho "visible"); ficar oculto não dispara nada, só
  // atualiza o estado — é essa atualização que faz o effect do timer, logo
  // abaixo, limpar o `setInterval` em background.
  useEffect(() => {
    setVisible(document.visibilityState === "visible")

    function onVisibilityChange() {
      const nowVisible = document.visibilityState === "visible"
      setVisible(nowVisible)
      if (nowVisible) attempt("visible")
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [attempt])

  // Foco da janela — evento distinto de visibilitychange (alt-tab entre duas
  // janelas do MESMO app visível, por exemplo, dispara focus sem mudar
  // visibilityState). O cooldown compartilhado em `shouldSyncGeneric` colapsa
  // o caso comum de focus+visibilitychange disparando juntos.
  useEffect(() => {
    function onFocus() {
      attempt("focus")
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [attempt])

  // Timer de polling — existe SE E SOMENTE SE `intervalActive && visible`.
  // Recriado (e destruído) sempre que qualquer um dos dois muda (ex.: um
  // refresh trouxe status terminal, ou a aba saiu/voltou).
  useEffect(() => {
    if (!intervalActive || !visible) return

    const intervalId = setInterval(() => {
      attempt("interval")
    }, pollIntervalMs)

    return () => clearInterval(intervalId)
  }, [intervalActive, visible, pollIntervalMs, attempt])

  return { setInteracting }
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes
// ─────────────────────────────────────────────────────────────────────────────

export function ActiveRequestAutoRefresh({
  requestId,
  status,
  initialToken,
  pollIntervalMs = ACTIVE_REQUEST_POLL_INTERVAL_MS,
  children,
}: {
  requestId: string
  status: RequestStatus
  /** Token computado pelo SERVIDOR, no mesmo render que produziu a página — NÃO `null`. */
  initialToken: string | null
  /**
   * Cadência do timer. Default preserva o contrato antigo (20s) — usado pelo
   * Diário, que não recebe este prop. As telas operacionais de Request
   * (detalhe) passam `REQUEST_OPERATIONAL_POLL_INTERVAL_MS` explicitamente.
   */
  pollIntervalMs?: number
  children: ReactNode
}) {
  const probe = useCallback(() => getRequestSyncProbeAction(requestId), [requestId])
  const { setInteracting } = useRequestSyncEngine({
    intervalActive: isRequestSyncActive(status),
    pollIntervalMs,
    initialToken,
    probe,
  })

  return (
    <InteractionContext.Provider value={{ setInteracting }}>
      {children}
    </InteractionContext.Provider>
  )
}

/**
 * Sincroniza `/tutor/requests`, `/requests` (profissional) e os respectivos
 * dashboards — REQUEST AUTO-SYNC RELIABILITY. Ao contrário do detalhe de uma
 * Request, uma lista não tem "um status" que decida se o timer vale a pena:
 * `intervalActive` fica sempre `true` enquanto a aba estiver visível, porque
 * uma request nova pode chegar mesmo que todas as atuais já estejam
 * terminais.
 */
export function RequestListAutoRefresh({
  role,
  initialToken,
  pollIntervalMs = REQUEST_OPERATIONAL_POLL_INTERVAL_MS,
  children,
}: {
  role: "tutor" | "professional"
  /** Token computado pelo SERVIDOR no mesmo render — mesma razão do prop acima. */
  initialToken: string | null
  pollIntervalMs?: number
  children: ReactNode
}) {
  const probe = useCallback(
    () =>
      role === "tutor"
        ? getTutorRequestListSyncProbeAction()
        : getProfessionalRequestListSyncProbeAction(),
    [role]
  )
  const { setInteracting } = useRequestSyncEngine({
    intervalActive: true,
    pollIntervalMs,
    initialToken,
    probe,
  })

  return (
    <InteractionContext.Provider value={{ setInteracting }}>
      {children}
    </InteractionContext.Provider>
  )
}
