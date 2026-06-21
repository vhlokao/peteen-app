import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CalendarDays,
  User,
  PawPrint,
  Inbox,
  CheckCircle2,
} from "lucide-react"

import { getAuthContext } from "@/modules/identity/application/get-session"
import {
  getMyRequestsAsProfessionalAction,
} from "@/modules/service-request/application/actions"
import {
  REQUEST_STATUS_LABELS,
  type RequestStatus,
  type ServiceRequestWithParticipants,
} from "@/modules/service-request/domain/types"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { SPECIES_LABELS } from "@/modules/tutor/domain/types"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Solicitações",
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge styles
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Partial<Record<RequestStatus, { label: string; className: string }>> = {
  PENDING: {
    label: "Aguardando",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  ACCEPTED: {
    label: "Aceito",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  IN_PROGRESS: {
    label: "Em andamento",
    className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  },
  COMPLETED: {
    label: "Concluído",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  CANCELLED_BY_TUTOR: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
  CANCELLED_BY_PROFESSIONAL: {
    label: "Recusado",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  DISPUTED: {
    label: "Em disputa",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  EXPIRED: {
    label: "Expirado",
    className: "bg-muted text-muted-foreground",
  },
}

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

// ─────────────────────────────────────────────────────────────────────────────
// RequestCard — shared component para tutor e profissional
// ─────────────────────────────────────────────────────────────────────────────

function RequestCard({
  request,
  perspective,
}: {
  request: ServiceRequestWithParticipants
  perspective: "tutor" | "professional"
}) {
  const badge = STATUS_BADGE[request.status] ?? {
    label: REQUEST_STATUS_LABELS[request.status],
    className: "bg-muted text-muted-foreground",
  }

  const otherParty = perspective === "professional" ? request.tutor : request.professional

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {/* Status + serviço */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
        <Badge variant="secondary" className="text-[0.65rem] font-normal">
          {SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}
        </Badge>
      </div>

      {/* Participante + pet */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <User className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium">{otherParty.displayName}</span>
          <span className="text-xs text-muted-foreground">· {otherParty.city}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <PawPrint className="size-3.5 shrink-0" />
          <span>
            {request.pet ? (
              <>
                {request.pet.name}
                <span className="ml-1 text-xs">
                  ({SPECIES_LABELS[request.pet.species]})
                </span>
              </>
            ) : (
              <span className="text-xs">Pet não informado</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" />
          <span>{formatDate(request.scheduledAt)}</span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/requests/${request.id}`}
        className={buttonVariants({ variant: "outline", size: "sm", className: "mt-1 w-full" })}
      >
        Ver detalhes
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Seção de grupo (professional view)
// ─────────────────────────────────────────────────────────────────────────────

function RequestGroup({
  title,
  count,
  requests,
  emptyMessage,
}: {
  title: string
  count: number
  requests: ServiceRequestWithParticipants[]
  emptyMessage?: string
}) {
  if (requests.length === 0 && !emptyMessage) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {count > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
            {count}
          </span>
        )}
      </div>

      {requests.length === 0 && emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
          {requests.map((req) => (
            <RequestCard key={req.id} request={req} perspective="professional" />
          ))}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — role-aware
//
// PROFESSIONAL: exibe grupos por status (PENDING primeiro)
// TUTOR:        exibe lista cronológica com status
//
// FASE 5: separar em rotas dedicadas por persona.
// ─────────────────────────────────────────────────────────────────────────────

export default async function RequestsPage() {
  const ctx = await getAuthContext()
  const isTutor = ctx.authenticated && ctx.user.primaryRole === "TUTOR"

  if (isTutor) {
    redirect("/tutor/requests")
  }

  const result = await getMyRequestsAsProfessionalAction({ limit: 50 })

  const requests: ServiceRequestWithParticipants[] = result.success ? result.data : []

  // ── Vista PROFISSIONAL — agrupada por prioridade ──────────────────────────

  const pending = requests.filter((r) => r.status === "PENDING")
  const accepted = requests.filter((r) => r.status === "ACCEPTED")
  const inProgress = requests.filter((r) => r.status === "IN_PROGRESS")
  const completed = requests.filter((r) => r.status === "COMPLETED")
  const terminal = requests.filter((r) =>
    ["CANCELLED_BY_TUTOR", "CANCELLED_BY_PROFESSIONAL", "DISPUTED", "EXPIRED"].includes(r.status)
  )

  const totalActive = pending.length + accepted.length + inProgress.length

  return (
    <div className="page-container">
      <PageHeader
        title="Solicitações"
        description="Gerencie os pedidos de serviço recebidos de tutores."
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-7" />}
          title="Aguardando solicitações"
          description="Quando um tutor solicitar seus serviços, o pedido aparecerá aqui."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {/* Pendentes — ação imediata requerida */}
          <RequestGroup
            title="Pendentes"
            count={pending.length}
            requests={pending}
            emptyMessage={
              totalActive === 0 ? undefined : "Nenhuma solicitação aguardando resposta."
            }
          />

          {/* Aceitos — aguardando início */}
          <RequestGroup
            title="Aceitos"
            count={accepted.length}
            requests={accepted}
          />

          {/* Em andamento — atendimentos ativos */}
          <RequestGroup
            title="Em andamento"
            count={inProgress.length}
            requests={inProgress}
          />

          {/* Concluídos */}
          {completed.length > 0 && (
            <RequestGroup
              title="Concluídos"
              count={completed.length}
              requests={completed}
            />
          )}

          {/* Cancelados / expirados */}
          {terminal.length > 0 && (
            <RequestGroup
              title="Encerrados"
              count={0}
              requests={terminal}
            />
          )}

          {/* Estado vazio de concluídos (apenas se não há outros) */}
          {completed.length === 0 && totalActive > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Concluídos</h2>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                <CheckCircle2 className="size-5 shrink-0 opacity-40" />
                <span>Nenhum atendimento concluído ainda.</span>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
