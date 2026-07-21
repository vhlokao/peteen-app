import { CheckCircle2, Circle, XCircle, Clock } from "lucide-react"

import type {
  RequestStatus,
} from "@/modules/service-request/domain/types"

const NAVY = "#2C4893"
const GREEN = "#40916C"
const CORAL = "#C7756A"

// ─────────────────────────────────────────────────────────────────────────────
// Timeline — estrutura de dados que guia a renderização.
//
// Cada etapa pode estar em um de 3 estados:
//   "done"    → concluída (verde, checkmark)
//   "active"  → etapa atual (azul, pulsando)
//   "pending" → ainda não chegou (cinza, circle)
//   "skipped" → não aplicável neste fluxo (ex: IN_PROGRESS foi pulado)
//
// Futuras auditorias (Fase 5):
//   Cada etapa pode receber um `auditEventId` para vincular ao AuditLog.
//   A estrutura já prevê o campo opcional para zero refatoração futura.
// ─────────────────────────────────────────────────────────────────────────────

type StepState = "done" | "active" | "pending" | "cancelled"

type TimelineStep = {
  id: string
  label: string
  sublabel?: string
  state: StepState
  timestamp?: Date | null
  /** Reservado para Fase 5 — AuditLog.id vinculado a esta etapa */
  auditEventId?: string
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

function buildSteps(request: {
  status: RequestStatus
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  completedAt: Date | null
}): TimelineStep[] {
  const { status, createdAt, updatedAt, startedAt, completedAt } = request

  const isCancelled =
    status === "CANCELLED_BY_TUTOR" ||
    status === "CANCELLED_BY_PROFESSIONAL" ||
    status === "DISPUTED" ||
    status === "EXPIRED"

  // Mapa de progresso — ordem linear do fluxo principal
  const ORDER: RequestStatus[] = [
    "PENDING",
    "ACCEPTED",
    "IN_PROGRESS",
    "COMPLETED",
  ]
  const currentIndex = ORDER.indexOf(status)

  function stepState(stepStatus: RequestStatus, stepIndex: number): StepState {
    if (isCancelled && stepIndex > 0) return "cancelled"
    if (currentIndex > stepIndex) return "done"
    if (currentIndex === stepIndex) return "active"
    return "pending"
  }

  const steps: TimelineStep[] = [
    {
      id: "created",
      label: "Solicitação criada",
      sublabel: "O tutor enviou o pedido",
      state: "done",
      timestamp: createdAt,
    },
    {
      id: "accepted",
      label: isCancelled
        ? status === "CANCELLED_BY_TUTOR"
          ? "Cancelado pelo tutor"
          : status === "CANCELLED_BY_PROFESSIONAL"
            ? "Recusado pelo profissional"
            : "Encerrado"
        : "Aceito pelo profissional",
      sublabel: isCancelled ? undefined : "O profissional confirmou o atendimento",
      // acceptedAt não existe no schema — updatedAt é a melhor aproximação
      // FASE 5: adicionar campo acceptedAt ao schema e migrar aqui
      state: isCancelled ? "cancelled" : stepState("ACCEPTED", 1),
      timestamp: isCancelled
        ? updatedAt
        : currentIndex >= 1
          ? updatedAt
          : null,
    },
  ]

  if (!isCancelled) {
    steps.push(
      {
        id: "in_progress",
        label: "Atendimento iniciado",
        sublabel: "O serviço está em andamento",
        state: stepState("IN_PROGRESS", 2),
        timestamp: startedAt,
      },
      {
        id: "completed",
        label: "Atendimento concluído",
        sublabel: "Serviço realizado com sucesso",
        state: stepState("COMPLETED", 3),
        timestamp: completedAt,
      }
    )
  }

  return steps
}

// ─────────────────────────────────────────────────────────────────────────────
// Ícone por estado
// ─────────────────────────────────────────────────────────────────────────────

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return <CheckCircle2 className="size-5 shrink-0" style={{ color: GREEN }} />
  }
  if (state === "active") {
    return (
      <div className="relative flex size-5 shrink-0 items-center justify-center">
        <div className="absolute size-5 animate-ping rounded-full" style={{ background: `${NAVY}4D` }} />
        <div className="size-3 rounded-full" style={{ background: NAVY }} />
      </div>
    )
  }
  if (state === "cancelled") {
    return <XCircle className="size-5 shrink-0" style={{ color: CORAL }} />
  }
  return <Circle className="size-5 shrink-0 text-muted-foreground/40" />
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

type RequestTimelineProps = {
  request: {
    status: RequestStatus
    createdAt: Date
    updatedAt: Date
    startedAt: Date | null
    completedAt: Date | null
  }
}

export function RequestTimeline({ request }: RequestTimelineProps) {
  const steps = buildSteps(request)

  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const dimmed = step.state === "pending"

        return (
          <div key={step.id} className="flex gap-3">
            {/* Coluna de ícone + linha vertical */}
            <div className="flex flex-col items-center">
              <StepIcon state={step.state} />
              {!isLast && (
                <div
                  className={
                    step.state === "done" || step.state === "cancelled"
                      ? "my-1 w-px flex-1"
                      : "my-1 w-px flex-1 bg-border"
                  }
                  style={
                    step.state === "done"
                      ? { minHeight: "24px", background: `${GREEN}66` }
                      : step.state === "cancelled"
                        ? { minHeight: "24px", background: `${CORAL}33` }
                        : { minHeight: "24px" }
                  }
                />
              )}
            </div>

            {/* Conteúdo */}
            <div className={`pb-5 ${isLast ? "pb-0" : ""} ${dimmed ? "opacity-40" : ""}`}>
              <p
                className={`text-sm font-medium leading-tight ${
                  step.state === "cancelled"
                    ? "text-destructive"
                    : step.state === "active"
                      ? "text-foreground"
                      : step.state === "done"
                        ? "text-foreground"
                        : "text-muted-foreground"
                }`}
              >
                {step.label}
              </p>
              {step.sublabel && step.state !== "cancelled" && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step.sublabel}
                </p>
              )}
              {step.timestamp && (
                <div className="mt-1 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                  <Clock className="size-3 shrink-0" />
                  <span>{formatDateTime(step.timestamp)}</span>
                  {step.id === "accepted" && (
                    <span className="opacity-60">(aprox.)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
