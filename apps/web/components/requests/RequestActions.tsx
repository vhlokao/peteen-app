"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, XCircle, Play, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  acceptServiceRequestAction,
  rejectServiceRequestAction,
  startServiceRequestAction,
  completeServiceRequestAction,
} from "@/modules/service-request/application/actions"
import { useSuspendAutoRefreshWhileEditing } from "@/modules/service-request/components/ActiveRequestAutoRefresh"
import {
  describeServiceStartBlock,
  resolveServiceStartEligibility,
} from "@/modules/service-request/domain/start-eligibility"
import type {
  RequestStatus,
  ServiceRequestData,
  ActionResult,
} from "@/modules/service-request/domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

const NAVY = "#1D2F6F"
const GREEN = "#40916C"

type RequestActionsProps = {
  requestId: string
  currentStatus: RequestStatus
  /** Horário agendado — decide a janela de "Iniciar atendimento" com scheduledHasTime. */
  scheduledAt: Date | null
  /** Precisão de scheduledAt: false = âncora legada, nunca hora real (ver domain/start-eligibility.ts). */
  scheduledHasTime: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensagens de sucesso por transição
// ─────────────────────────────────────────────────────────────────────────────

const SUCCESS_MESSAGES: Partial<Record<RequestStatus, string>> = {
  ACCEPTED: "Solicitação aceita! O tutor será notificado.",
  CANCELLED_BY_PROFESSIONAL: "Solicitação recusada.",
  IN_PROGRESS: "Atendimento iniciado!",
  COMPLETED: "Atendimento concluído! O tutor já pode avaliar o serviço.",
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elegibilidade de "Iniciar atendimento", recalculada localmente sem tocar o
 * servidor — a resposta depende só de `scheduledAt`/`scheduledHasTime` (já
 * conhecidos) e do relógio do próprio navegador.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UM `setTimeout`, NÃO POLLING
 *
 * O botão precisa liberar sozinho no instante exato em que a janela abre, sem
 * exigir refresh manual (item 6 da missão). Em vez de um intervalo rodando o
 * tempo todo, agenda-se UM timer para o instante preciso de liberação
 * (`startableAt`) — ele dispara uma vez e o efeito se desliga. Focus/
 * visibilitychange recalculam por fora: se a aba ficou suspensa (mobile em
 * background, notebook fechado), o timer pode não ter disparado no momento
 * certo, e voltar à tela precisa corrigir na hora, não esperar o próximo tick.
 *
 * Isto é INDEPENDENTE do probe de `ActiveRequestAutoRefresh` — aquele
 * consulta o servidor a cada ~20s para status/disputa/review/Diário; este
 * hook não faz nenhuma chamada de rede, porque não precisa: nada que o
 * servidor saiba muda se "agora" já passou de `startableAt`.
 */
function useServiceStartEligibility(scheduledAt: Date | null, scheduledHasTime: boolean) {
  const [eligibility, setEligibility] = useState(() =>
    resolveServiceStartEligibility({ scheduledAt, scheduledHasTime, now: new Date() })
  )

  useEffect(() => {
    const recompute = () =>
      setEligibility(
        resolveServiceStartEligibility({ scheduledAt, scheduledHasTime, now: new Date() })
      )

    recompute()

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const atual = resolveServiceStartEligibility({ scheduledAt, scheduledHasTime, now: new Date() })
    if (!atual.eligible && atual.reason === "TOO_EARLY") {
      const delayMs = atual.startableAt.getTime() - Date.now()
      // Nunca negativo (setTimeout trataria como 0, mas o clamp documenta a
      // intenção): a janela já pode ter aberto entre o cálculo acima e aqui.
      timeoutId = setTimeout(recompute, Math.max(0, delayMs))
    }

    document.addEventListener("visibilitychange", recompute)
    window.addEventListener("focus", recompute)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", recompute)
      window.removeEventListener("focus", recompute)
    }
    // scheduledAt é um Date novo a cada render do pai (Server Component); usar
    // .getTime() na dependência evitaria recriar o timer por identidade, mas
    // reagendar no valor (raro mudar) é seguro e mantém o efeito síncrono com
    // as props reais.
  }, [scheduledAt, scheduledHasTime])

  return eligibility
}

export function RequestActions({
  requestId,
  currentStatus,
  scheduledAt,
  scheduledHasTime,
}: RequestActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Mesma razão do lado do tutor: uma transição de status em voo não pode
  // disputar o ciclo de render com um refresh automático concorrente.
  useSuspendAutoRefreshWhileEditing(isPending)

  const startEligibility = useServiceStartEligibility(scheduledAt, scheduledHasTime)

  function handleAction(
    action: () => Promise<ActionResult<ServiceRequestData>>,
    targetStatus: RequestStatus
  ) {
    startTransition(async () => {
      const result = await action()

      if (!result.success) {
        toast.error(result.error ?? "Erro ao processar ação. Tente novamente.")
        // Mesmo numa falha, o servidor pode ter mudado o status por baixo
        // (ex.: aceite bloqueado porque a request acabou de expirar) — sem
        // isso, os botões continuariam visíveis para uma request que já não
        // é mais PENDING.
        router.refresh()
        return
      }

      const message = SUCCESS_MESSAGES[targetStatus] ?? "Ação realizada com sucesso."
      toast.success(message)

      // Re-renderiza o Server Component com os dados atualizados
      router.refresh()
    })
  }

  // ── PENDING — profissional decide aceitar ou recusar ──────────────────────

  if (currentStatus === "PENDING") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1 gap-2"
            style={{ background: GREEN }}
            onClick={() =>
              handleAction(
                () => acceptServiceRequestAction(requestId),
                "ACCEPTED"
              )
            }
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Aceitar solicitação
          </Button>

          <Button
            variant="outline"
            className="flex-1 gap-2 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() =>
              handleAction(
                () => rejectServiceRequestAction(requestId),
                "CANCELLED_BY_PROFESSIONAL"
              )
            }
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            Recusar
          </Button>
        </div>
      </div>
    )
  }

  // ── ACCEPTED — profissional inicia o atendimento ──────────────────────────

  if (currentStatus === "ACCEPTED") {
    return (
      <div className="flex flex-col gap-1.5">
        <Button
          className="w-full gap-2"
          style={{ background: NAVY }}
          onClick={() =>
            handleAction(
              () => startServiceRequestAction(requestId),
              "IN_PROGRESS"
            )
          }
          disabled={isPending || !startEligibility.eligible}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Iniciar atendimento
        </Button>
        {!startEligibility.eligible && (
          <p className="text-center text-xs text-muted-foreground">
            {describeServiceStartBlock(startEligibility)}
          </p>
        )}
      </div>
    )
  }

  // ── IN_PROGRESS — profissional conclui o atendimento ─────────────────────

  if (currentStatus === "IN_PROGRESS") {
    return (
      <Button
        className="w-full gap-2"
        style={{ background: GREEN }}
        onClick={() =>
          handleAction(
            () => completeServiceRequestAction(requestId),
            "COMPLETED"
          )
        }
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        Concluir atendimento
      </Button>
    )
  }

  // ── Estados terminais — nenhuma ação disponível ───────────────────────────

  return null
}
