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

const NAVY = "#1D2F6F"
const GREEN = "#40916C"

type RequestActionsProps = {
  requestId: string
  currentStatus: RequestStatus
  /** Data agendada do serviço — bloqueia "Iniciar atendimento" antes dela. */
  scheduledAt: Date | null
  /**
   * Até quando o cooldown antifraude de 24h (conclusão recente com o mesmo
   * tutor) segue ativo — null quando não há cooldown. Só é relevante para
   * PENDING (bloqueia "Aceitar"); o servidor é quem decide de fato, isto é
   * só para explicar/desabilitar a UI proativamente.
   */
  cooldownReleaseAt: Date | null
}

const SCHEDULED_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const COOLDOWN_DATETIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
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
  cooldownReleaseAt,
}: RequestActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Bloqueio de "Iniciar atendimento" antes da data agendada (comparação por dia).
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const scheduled = scheduledAt ? new Date(scheduledAt) : null
  if (scheduled) scheduled.setHours(0, 0, 0, 0)
  const beforeDate = scheduled ? today < scheduled : false

  // Bloqueio de "Aceitar solicitação" durante o cooldown antifraude de 24h.
  // Só desabilita/explica a UI — a validação real é sempre no servidor.
  const cooldownUntil = cooldownReleaseAt ? new Date(cooldownReleaseAt) : null
  const cooldownActive = cooldownUntil ? new Date() < cooldownUntil : false

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
            disabled={isPending || cooldownActive}
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

        {cooldownActive && cooldownUntil && (
          <p className="text-center text-xs text-muted-foreground">
            Você concluiu um atendimento com este tutor há menos de 24 horas.
            Esta solicitação poderá ser aceita a partir de{" "}
            {COOLDOWN_DATETIME_FORMAT.format(cooldownUntil)}.
          </p>
        )}
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
