import Link from "next/link"
import {
  CalendarDays,
  User,
  PawPrint,
  Star,
  Clock,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  REQUEST_STATUS_LABELS,
  type RequestStatus,
  type ServiceRequestWithParticipants,
} from "@/modules/service-request/domain/types"
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types"
import { SPECIES_LABELS } from "@/modules/tutor/domain/types"

const STATUS_BADGE: Partial<
  Record<RequestStatus, { label: string; className: string }>
> = {
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

function getPrimaryAction(request: ServiceRequestWithParticipants): {
  label: string
  href: string
  variant: "default" | "outline"
} {
  if (request.status === "COMPLETED" && !request.review) {
    return {
      label: "Avaliar atendimento",
      href: `/tutor/requests/${request.id}`,
      variant: "default",
    }
  }
  if (request.status === "PENDING") {
    return {
      label: "Aguardando resposta",
      href: `/tutor/requests/${request.id}`,
      variant: "outline",
    }
  }
  return {
    label: "Ver detalhes",
    href: `/tutor/requests/${request.id}`,
    variant: "outline",
  }
}

export function TutorRequestCard({
  request,
}: {
  request: ServiceRequestWithParticipants
}) {
  const badge = STATUS_BADGE[request.status] ?? {
    label: REQUEST_STATUS_LABELS[request.status],
    className: "bg-muted text-muted-foreground",
  }
  const action = getPrimaryAction(request)
  const pro = request.professional

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
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

      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <User className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium">{pro.displayName}</span>
          <span className="text-xs text-muted-foreground">· {pro.city}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <PawPrint className="size-3.5 shrink-0" />
          {request.pet ? (
            <span>
              {request.pet.name}
              <span className="ml-1 text-xs">
                ({SPECIES_LABELS[request.pet.species]})
              </span>
            </span>
          ) : (
            <span className="text-xs">Pet não informado</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" />
          <span>{formatDate(request.scheduledAt)}</span>
        </div>

        {request.review ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            Avaliado · {request.review.rating}/5
          </div>
        ) : request.status === "COMPLETED" ? (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <Clock className="size-3" />
            Aguardando sua avaliação
          </div>
        ) : null}
      </div>

      <Link
        href={action.href}
        className={buttonVariants({
          variant: action.variant,
          size: "sm",
          className: "mt-1 w-full",
        })}
      >
        {action.label}
      </Link>
    </div>
  )
}
