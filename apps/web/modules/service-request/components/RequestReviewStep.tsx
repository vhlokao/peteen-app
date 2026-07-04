import { AlertCircle, CalendarDays, PawPrint, User } from "lucide-react"

import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { formatPublicServicePrice } from "@/modules/professional/domain/format-service-price"
import { SPECIES_LABELS, type PetData } from "@/modules/tutor/domain/types"
import { parseCivilDateToStableInstant } from "@/lib/date/parse-civil-date"

type ServiceOption = {
  id: string
  name: string
  serviceType: ServiceType
  priceMin: number | null
  priceMax: number | null
}

type RequestReviewStepProps = {
  professionalName: string
  pet: PetData | undefined
  service: ServiceOption | undefined
  scheduledAt: string
  notes?: string
  errorMessage?: string | null
}

function formatDate(value: string): string {
  if (!value) return "—"
  // Mesmo helper usado na submissão (RequestServiceSheet) — a revisão mostra
  // exatamente o mesmo dia civil que será persistido, sem interpretação
  // paralela de fuso horário.
  const date = parseCivilDateToStableInstant(value)
  if (isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/**
 * Etapa 4 — revisão. Mostra exatamente o que será enviado, sem transformar
 * nada: pet/serviço/data/observações já escolhidos nas etapas anteriores.
 * O submit real só acontece a partir daqui (form-level, ver RequestServiceSheet).
 */
export function RequestReviewStep({
  professionalName,
  pet,
  service,
  scheduledAt,
  notes,
  errorMessage,
}: RequestReviewStepProps) {
  const priceLabel = service ? formatPublicServicePrice(service) : null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Sua solicitação será enviada para <strong className="text-foreground">{professionalName}</strong>.
      </p>

      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3 px-4 py-3">
          <PawPrint className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Pet</p>
            <p className="truncate text-sm font-medium text-foreground">
              {pet ? `${pet.name} · ${pet.breed || SPECIES_LABELS[pet.species]}` : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <User className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Serviço</p>
            <p className="truncate text-sm font-medium text-foreground">
              {service ? `${service.name} · ${SERVICE_TYPE_LABELS[service.serviceType]}` : "—"}
            </p>
            {priceLabel && <p className="text-xs text-muted-foreground">{priceLabel}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Data</p>
            <p className="text-sm font-medium text-foreground">{formatDate(scheduledAt)}</p>
          </div>
        </div>

        {notes && (
          <div className="px-4 py-3">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              Observações
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-foreground">{notes}</p>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}
