import Link from "next/link"
import { CalendarDays, PawPrint, User } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { SPECIES_LABELS } from "@/modules/tutor/domain/types"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import {
  PROFESSIONAL_REQUEST_STATUS_LABELS,
  PROFESSIONAL_REQUEST_STATUS_TONE,
  PROFESSIONAL_REQUEST_STATUS_TONE_CLASS,
} from "../domain/request-status-display"

function formatDate(date: Date | null): string {
  if (!date) return "Data a combinar"
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(date))
}

/**
 * Próximo atendimento — só renderiza se houver um ACCEPTED/IN_PROGRESS real.
 * A escolha de "próximo" é a data mais próxima entre esses dois estados,
 * sem regra nova: mesma lista já buscada para o bloco de atenção.
 */
export function ProfessionalNextAppointmentCard({
  appointment,
}: {
  appointment: ServiceRequestWithParticipants | null
}) {
  if (!appointment) return null

  const tone = PROFESSIONAL_REQUEST_STATUS_TONE[appointment.status]
  const initials = appointment.tutor.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Próximo atendimento
      </p>
      <div className="flex items-center gap-3">
        <Avatar className="size-11 shrink-0 rounded-xl">
          {appointment.tutor.avatarUrl && (
            <AvatarImage src={appointment.tutor.avatarUrl} alt={appointment.tutor.displayName} />
          )}
          <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{appointment.tutor.displayName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="size-3 shrink-0" />
              {SERVICE_TYPE_LABELS[appointment.serviceType as ServiceType]}
            </span>
            {appointment.pet && (
              <span className="inline-flex items-center gap-1">
                <PawPrint className="size-3 shrink-0" />
                {appointment.pet.name} ({SPECIES_LABELS[appointment.pet.species]})
              </span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${PROFESSIONAL_REQUEST_STATUS_TONE_CLASS[tone]}`}
        >
          {PROFESSIONAL_REQUEST_STATUS_LABELS[appointment.status]}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" />
          {formatDate(appointment.scheduledAt)}
        </span>
        <Link
          href={`/requests/${appointment.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Ver detalhes
        </Link>
      </div>
    </section>
  )
}
