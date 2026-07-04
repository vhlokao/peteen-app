import Link from "next/link"
import { CalendarDays, MapPin, PawPrint } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { SPECIES_LABELS } from "@/modules/tutor/domain/types"
import {
  PROFESSIONAL_REQUEST_CARD_CTA,
  PROFESSIONAL_REQUEST_CARD_NEXT_STEP,
} from "../domain/request-status-display"
import { ProfessionalRequestStatusPill } from "./professional-request-status-pill"

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

/**
 * Card de solicitação na perspectiva do profissional (UX 3.8B) — mesmo
 * padrão visual do card do tutor (UX 3.7), com identidade/labels
 * invertidos: aqui mostra o tutor, não o profissional.
 */
export function ProfessionalRequestCard({
  request,
}: {
  request: ServiceRequestWithParticipants
}) {
  const tutor = request.tutor
  const initials = tutor.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const nextStep = PROFESSIONAL_REQUEST_CARD_NEXT_STEP[request.status]
  const ctaLabel = PROFESSIONAL_REQUEST_CARD_CTA[request.status] ?? "Ver detalhes"

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-start gap-3">
        <Avatar className="size-11 shrink-0 rounded-xl">
          {tutor.avatarUrl && <AvatarImage src={tutor.avatarUrl} alt={tutor.displayName} />}
          <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{tutor.displayName}</p>
          {tutor.city && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{tutor.city}</span>
            </div>
          )}
        </div>
        <ProfessionalRequestStatusPill status={request.status} size="sm" />
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

      {nextStep && <p className="text-xs font-medium text-primary">{nextStep}</p>}

      <Link
        href={`/requests/${request.id}`}
        className={buttonVariants({
          variant: request.status === "PENDING" ? "default" : "outline",
          size: "sm",
          className: "mt-1 w-full",
        })}
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
