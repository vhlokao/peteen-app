import Link from "next/link"
import { CalendarDays, MapPin, PawPrint, Star } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { SPECIES_LABELS } from "@/modules/tutor/domain/types"
import { REQUEST_STATUS_META } from "../domain/request-status-display"
import { TutorRequestStatusPill } from "./TutorRequestStatusPill"

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

/**
 * Card de solicitação do tutor (UX 3.7) — status humano central
 * (REQUEST_STATUS_META), próximo passo em linha curta, CTA fixo
 * "Ver detalhes" (a ação específica de cada estado — avaliar, aguardar
 * etc. — já é comunicada pelo texto de próximo passo, não pelo label do CTA).
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
      className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-11 shrink-0 rounded-xl">
          {pro.avatarUrl && <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />}
          <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{pro.displayName}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{pro.city}</span>
          </div>
        </div>
        <TutorRequestStatusPill status={request.status} size="sm" />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <PawPrint className="size-3 shrink-0" />
          {request.pet ? (
            <>
              {request.pet.name}{" "}
              <span className="text-muted-foreground/70">
                ({SPECIES_LABELS[request.pet.species]})
              </span>
            </>
          ) : (
            "Pet não informado"
          )}
        </span>
        <span className="text-border">·</span>
        <span>{SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}</span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3 shrink-0" />
          {formatDate(request.scheduledAt)}
        </span>
      </div>

      {request.review ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          Avaliado · {request.review.rating}/5
        </div>
      ) : nextStepLine ? (
        <p className="text-xs font-medium text-primary">{nextStepLine}</p>
      ) : null}

      <span className="mt-auto self-start text-xs font-medium text-primary">
        Ver detalhes →
      </span>
    </Link>
  )
}
