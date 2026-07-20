import Link from "next/link"
import { ChevronRight, Star } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { REQUEST_STATUS_META } from "../domain/request-status-display"
import { TutorRequestStatusPill } from "./TutorRequestStatusPill"

const NAVY = "#1D2F6F"

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

/**
 * Card de solicitação do tutor (reskin) — status humano central
 * (REQUEST_STATUS_META), próximo passo em linha curta (ou avaliação já
 * enviada, mesma condição mutuamente exclusiva de antes), chevron indicando
 * navegação para o detalhe.
 */
export function TutorRequestCard({
  request,
}: {
  request: ServiceRequestWithParticipants
}) {
  const meta = REQUEST_STATUS_META[request.status]
  const pro = request.professional
  const initials = pro.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const nextStepLine =
    request.status === "COMPLETED" && request.review
      ? null
      : meta.nextStep

  return (
    <Link
      href={`/tutor/requests/${request.id}`}
      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      <Avatar className="size-12 shrink-0 rounded-xl" style={{ background: "#E8EEF6" }}>
        {pro.avatarUrl && <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />}
        <AvatarFallback
          className="rounded-xl bg-transparent text-sm font-bold"
          style={{ color: NAVY }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <TutorRequestStatusPill status={request.status} size="sm" className="mb-1.5" />
        <p className="truncate text-sm font-bold text-foreground">{pro.displayName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}
          {" · "}
          {request.pet ? request.pet.name : "Pet não informado"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">
          {formatDate(request.scheduledAt)}
        </p>

        {request.review ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            Avaliado · {request.review.rating}/5
          </p>
        ) : nextStepLine ? (
          <p className="mt-1.5 text-xs font-medium text-primary">{nextStepLine}</p>
        ) : null}
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
