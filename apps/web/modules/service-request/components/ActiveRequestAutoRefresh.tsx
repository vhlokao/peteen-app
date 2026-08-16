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
  shouldSync,
  shouldRunPollTimer,
  shouldRefreshAfterProbe,
  ACTIVE_REQUEST_POLL_INTERVAL_MS,
  type ActiveRequestSyncTrigger,
} from "../domain/active-request-sync"
import { getRequestSyncProbeAction } from "../application/actions"
import type { RequestStatus } from "../domain/types"

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
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function ActiveRequestAutoRefresh({
  requestId,
  status,
  initialToken,
  children,
}: {
  requestId: string
  status: RequestStatus
  /**
   * Token computado pelo SERVIDOR, no mesmo render que produziu a página —
   * NÃO `null`. Sem isto, o PRIMEIRO probe do componente (que pode acontecer
   * bem depois do mount: em status terminal não há timer, só foco/
   * visibilidade) trataria qualquer coisa que já tivesse mudado entre o SSR
   * e esse primeiro probe como "estado inicial", engolindo a mudança sem
   * nunca sincronizar. Achado ao vivo do hardening: disputa criada
   * externamente, sem nenhum probe rodar por 104s (aba sem foco/visibility
   * naturais nesse intervalo), o primeiro foco manual absorveu a disputa
   * como baseline em vez de detectá-la como diferença. Ver
   * sync-snapshot.ts — quem calcula isto no servidor usa a MESMA
   * `buildRequestSyncToken`, garantindo que o primeiro probe do cliente
   * comece comparando contra o que a tela já mostra, não contra nada.
   */
  initialToken: string | null
  children: ReactNode
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Otimista (true) porque `document` não existe durante SSR — corrigido no
  // primeiro effect após montar, e mantido correto dali em diante pelo
  // listener de visibilitychange. Nunca dispara refresh no mount só por
  // "descobrir" a visibilidade real: o servidor já mandou dado fresco.
  const [visible, setVisible] = useState(true)

  // Conjunto de ids interagindo agora. Ref, não state: registrar uma tecla
  // digitada não pode re-renderizar a árvore inteira da Request.
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
  // comparação. Seedado com `initialToken` (do SSR), NUNCA com `null` — ver
  // o comentário do prop acima para o porquê.
  const lastTokenRef = useRef<string | null>(initialToken)

  const statusRef = useRef(status)
  statusRef.current = status

  const attempt = useCallback(
    (trigger: ActiveRequestSyncTrigger) => {
      const now = Date.now()
      const deve = shouldSync(
        trigger,
        {
          status: statusRef.current,
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

      getRequestSyncProbeAction(requestId)
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
    [router, startTransition, requestId]
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
  // visibilityState). O cooldown compartilhado em `shouldSync` colapsa o caso
  // comum de focus+visibilitychange disparando juntos.
  useEffect(() => {
    function onFocus() {
      attempt("focus")
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [attempt])

  // Timer de polling — existe SE E SOMENTE SE `shouldRunPollTimer` for
  // verdadeiro. Recriado (e destruído) sempre que `status` muda (ex.: um
  // refresh trouxe COMPLETED) ou `visible` muda (aba saiu/voltou).
  useEffect(() => {
    if (!shouldRunPollTimer(status, visible)) return

    const intervalId = setInterval(() => {
      attempt("interval")
    }, ACTIVE_REQUEST_POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [status, visible, attempt])

  return (
    <InteractionContext.Provider value={{ setInteracting }}>
      {children}
    </InteractionContext.Provider>
  )
}
