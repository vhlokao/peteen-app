"use client"

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { NotificationEmptyState } from "./notification-empty-state"
import {
  NotificationCardContent,
  notificationCardClasses,
} from "./notification-card"
import {
  countUnread,
  shouldProbeNotifications,
  shouldRefreshNotifications,
  NOTIFICATION_PROBE_INTERVAL_MS,
  type NotificationProbeTrigger,
} from "../domain/read-state"
import {
  getProfessionalNotificationProbeAction,
  getTutorNotificationProbeAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "../application/actions"
import type { NotificationItem } from "../domain/types"

type Props = {
  items: NotificationItem[]
  role: "tutor" | "professional"
  emptyTitle: string
  emptyDescription: string
  /** Token do MESMO render que produziu `items` — nunca `null` na prática. */
  initialToken: string | null
}

/**
 * Central de notificações — leitura, "marcar todas" e atualização automática.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ABRIR A CENTRAL NÃO MARCA NADA (decisão de produto, item 4)
 *
 * O usuário precisa PODER VER o que é novo. Marcar tudo só porque a tela
 * abriu destrói exatamente a informação que ele veio buscar — e é o motivo
 * de não existir `seenAt` separado: sem marcação automática na abertura, os
 * dois estados colapsam num só.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OTIMISMO NA LEITURA, MAS NUNCA NA NAVEGAÇÃO
 *
 * Clicar marca só aquele item. A UI reage na hora (`useOptimistic`) porque
 * esperar o round-trip antes de navegar deixaria o clique "morto" por alguns
 * centésimos. Se a marcação falhar, a navegação NÃO é bloqueada — perder o
 * destino por causa de um estado cosmético seria pior que o estado ficar
 * desatualizado; o item volta a aparecer como não lido no próximo refresh,
 * que é o estado verdadeiro.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROBE BARATO, NÃO POLLING DO FEED
 *
 * A cada 10s (e imediatamente ao voltar o foco) consulta apenas um token
 * agregado — nunca `getNotifications()`. Só quando o token muda é que
 * `router.refresh()` re-deriva o feed no servidor. Ver
 * infrastructure/probe-queries.ts para o custo real de cada caminho.
 */
export function NotificationFeed({
  items,
  role,
  emptyTitle,
  emptyDescription,
  initialToken,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Sobrepõe `isRead` para as chaves marcadas nesta sessão de tela, antes de
  // o servidor confirmar. O array do servidor continua sendo a base — no
  // próximo refresh o otimismo é descartado e a verdade prevalece.
  const [lidasOtimistas, marcarOtimista] = useOptimistic(
    new Set<string>(),
    (atual, chave: string) => new Set(atual).add(chave)
  )

  const comOtimismo = items.map((item) =>
    lidasOtimistas.has(item.id) ? { ...item, isRead: true } : item
  )
  const naoLidas = countUnread(comOtimismo)

  // ── Marcação individual ────────────────────────────────────────────────────

  // Guard contra duplo clique: o mesmo item não dispara duas mutations.
  const emVooRef = useRef<Set<string>>(new Set())

  const marcarUma = useCallback(
    (chave: string) => {
      if (emVooRef.current.has(chave)) return
      emVooRef.current.add(chave)

      startTransition(async () => {
        marcarOtimista(chave)
        const resultado = await markNotificationReadAction(role, chave)
        emVooRef.current.delete(chave)
        // Falha silenciosa de propósito: o usuário já está navegando para o
        // destino. Um toast de erro sobre algo cosmético, no meio de uma
        // navegação, seria ruído — e o próximo refresh corrige o estado.
        if (resultado.success) router.refresh()
      })
    },
    [role, marcarOtimista, router, startTransition]
  )

  // ── Marcar todas ───────────────────────────────────────────────────────────

  const [marcandoTodas, setMarcandoTodas] = useState(false)

  function marcarTodas() {
    setMarcandoTodas(true)
    startTransition(async () => {
      const resultado = await markAllNotificationsReadAction(role)
      setMarcandoTodas(false)
      if (!resultado.success) {
        toast.error(resultado.error)
        return
      }
      // Sem F5: re-deriva o feed e recalcula o badge do layout no mesmo ciclo.
      router.refresh()
    })
  }

  // ── Probe ──────────────────────────────────────────────────────────────────

  const [visivel, setVisivel] = useState(true)
  const ultimaTentativaRef = useRef<number | null>(null)
  const sondandoRef = useRef(false)
  const ultimoTokenRef = useRef<string | null>(initialToken)

  const sondar = useCallback(
    (trigger: NotificationProbeTrigger) => {
      const agora = Date.now()
      const deve = shouldProbeNotifications(
        trigger,
        {
          documentVisible: document.visibilityState === "visible",
          isProbing: sondandoRef.current,
          lastAttemptAt: ultimaTentativaRef.current,
        },
        agora
      )
      if (!deve) return

      ultimaTentativaRef.current = agora
      sondandoRef.current = true

      const probe =
        role === "tutor"
          ? getTutorNotificationProbeAction()
          : getProfessionalNotificationProbeAction()

      probe
        .then((resultado) => {
          if (!resultado.success) return
          if (shouldRefreshNotifications(ultimoTokenRef.current, resultado.token)) {
            ultimoTokenRef.current = resultado.token
            startTransition(() => router.refresh())
          } else {
            ultimoTokenRef.current = resultado.token
          }
        })
        .catch((erro) => {
          // Probe é só um fetch — falhar não pode deixar rastro visível nem
          // mudar o que a tela mostra. O próximo ciclo tenta de novo.
          console.error("[notification-probe] falhou", {
            erro: String(erro).slice(0, 120),
          })
        })
        .finally(() => {
          sondandoRef.current = false
        })
    },
    [role, router, startTransition]
  )

  useEffect(() => {
    setVisivel(document.visibilityState === "visible")

    function aoMudarVisibilidade() {
      const agoraVisivel = document.visibilityState === "visible"
      setVisivel(agoraVisivel)
      if (agoraVisivel) sondar("visible")
    }

    document.addEventListener("visibilitychange", aoMudarVisibilidade)
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade)
  }, [sondar])

  useEffect(() => {
    function aoFocar() {
      sondar("focus")
    }
    window.addEventListener("focus", aoFocar)
    return () => window.removeEventListener("focus", aoFocar)
  }, [sondar])

  // O timer existe SE E SOMENTE SE a aba está visível — `visivel` precisa ser
  // state (não leitura pontual) justamente para este efeito recriar/limpar o
  // intervalo quando a aba sai e volta.
  useEffect(() => {
    if (!visivel) return
    const id = setInterval(() => sondar("interval"), NOTIFICATION_PROBE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [visivel, sondar])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return <NotificationEmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-4">
      {naoLidas > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {naoLidas === 1 ? "1 não lida" : `${naoLidas} não lidas`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={marcarTodas}
            disabled={marcandoTodas}
            pending={marcandoTodas}
            pendingText="Marcando…"
          >
            <CheckCheck className="size-4" />
            Marcar todas como lidas
          </Button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {comOtimismo.map((item) => (
          <li key={item.id}>
            {item.href ? (
              <a
                href={item.href}
                onClick={(evento) => {
                  // Deixa o browser fazer o trabalho de navegação (inclusive
                  // ctrl/cmd+clique para nova aba, que `router.push` quebraria);
                  // só encaixamos a marcação de leitura por cima.
                  if (item.isRead === false) marcarUma(item.id)
                  if (evento.metaKey || evento.ctrlKey) return
                }}
                className={notificationCardClasses(item, true)}
              >
                <NotificationCardContent item={item} />
              </a>
            ) : (
              <div className={notificationCardClasses(item, false)}>
                <NotificationCardContent item={item} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
