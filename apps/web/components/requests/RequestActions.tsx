"use client"

import { useTransition } from "react"
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
import type {
  RequestStatus,
  ServiceRequestData,
  ActionResult,
} from "@/modules/service-request/domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type RequestActionsProps = {
  requestId: string
  currentStatus: RequestStatus
  /** Data agendada do serviço — bloqueia "Iniciar atendimento" antes dela. */
  scheduledAt: Date | null
}

const SCHEDULED_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

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

export function RequestActions({
  requestId,
  currentStatus,
  scheduledAt,
}: RequestActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Bloqueio de "Iniciar atendimento" antes da data agendada (comparação por dia).
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const scheduled = scheduledAt ? new Date(scheduledAt) : null
  if (scheduled) scheduled.setHours(0, 0, 0, 0)
  const beforeDate = scheduled ? today < scheduled : false

  function handleAction(
    action: () => Promise<ActionResult<ServiceRequestData>>,
    targetStatus: RequestStatus
  ) {
    startTransition(async () => {
      const result = await action()

      if (!result.success) {
        toast.error(result.error ?? "Erro ao processar ação. Tente novamente.")
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="flex-1 gap-2"
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
    )
  }

  // ── ACCEPTED — profissional inicia o atendimento ──────────────────────────

  if (currentStatus === "ACCEPTED") {
    return (
      <div className="flex flex-col gap-1.5">
        <Button
          className="w-full gap-2"
          onClick={() =>
            handleAction(
              () => startServiceRequestAction(requestId),
              "IN_PROGRESS"
            )
          }
          disabled={isPending || beforeDate}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Iniciar atendimento
        </Button>
        {beforeDate && scheduled && (
          <p className="text-center text-xs text-muted-foreground">
            Disponível em {SCHEDULED_DATE_FORMAT.format(scheduled)}
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
