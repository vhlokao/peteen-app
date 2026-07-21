import { CalendarDays, Info, MapPin, PawPrint, Quote, Repeat2, Tag } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { SPECIES_LABELS, type Species } from "@/modules/tutor/domain/types"
import { RELATIONSHIP_LEVEL_ICONS, RELATIONSHIP_LEVEL_LABELS } from "@/modules/relationship/domain/constants"
import { formatServiceCount } from "@/modules/relationship/domain/relationship-levels"
import type { RelationshipLevel } from "@/modules/relationship/domain/types"

type SummaryPet = {
  id: string
  name: string
  species: Species
  breed: string | null
  hasSpecialNeeds: boolean
}

type SummaryTutor = {
  displayName: string
  avatarUrl: string | null
  city: string
}

type PriorRelationship = {
  completedServices: number
  relationshipLevel: RelationshipLevel
}

type ProfessionalRequestSummaryProps = {
  tutor: SummaryTutor
  pet: SummaryPet | null
  serviceType: ServiceType
  scheduledAtLabel: string
  notes: string | null
  isRecurring: boolean
  priorRelationship: PriorRelationship | null
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-foreground">{value}</div>
      </div>
    </div>
  )
}

/**
 * Resumo do atendimento — perspectiva do profissional. Preço não aparece
 * porque ServiceRequest não guarda preço (só serviceType); a relação
 * anterior só aparece se completedServices > 0 (dado real, sem peso de
 * recorrência exposto).
 */
export function ProfessionalRequestSummary({
  tutor,
  pet,
  serviceType,
  scheduledAtLabel,
  notes,
  isRecurring,
  priorRelationship,
}: ProfessionalRequestSummaryProps) {
  const initials = tutor.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 shrink-0 rounded-xl">
          {tutor.avatarUrl && <AvatarImage src={tutor.avatarUrl} alt={tutor.displayName} />}
          <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{tutor.displayName}</p>
          <p className="text-xs text-muted-foreground">Tutor(a)</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{tutor.city}</span>
          </div>
        </div>
      </div>

      {priorRelationship && priorRelationship.completedServices > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <span className="shrink-0 text-base" aria-hidden>
            {RELATIONSHIP_LEVEL_ICONS[priorRelationship.relationshipLevel]}
          </span>
          <p className="text-xs text-foreground">
            Você já atendeu <span className="font-semibold">{tutor.displayName}</span>{" "}
            <span className="font-semibold text-primary">
              {formatServiceCount(priorRelationship.completedServices)}
            </span>
            {" · "}
            <span className="text-muted-foreground">
              {RELATIONSHIP_LEVEL_LABELS[priorRelationship.relationshipLevel]}
            </span>
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4 border-t border-border/70 pt-4">
        <InfoRow
          icon={<PawPrint className="size-4" />}
          label="Pet"
          value={
            pet ? (
              <span>
                {pet.name}
                <span className="ml-1.5 text-muted-foreground">
                  ({SPECIES_LABELS[pet.species]})
                  {pet.breed ? ` · ${pet.breed}` : ""}
                </span>
                {pet.hasSpecialNeeds && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                    <Info className="size-3" />
                    Necessidades especiais
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Não informado</span>
            )
          }
        />
        <InfoRow
          icon={<Tag className="size-4" />}
          label="Tipo de serviço"
          value={
            <span className="flex items-center gap-1.5">
              {SERVICE_TYPE_LABELS[serviceType]}
              {isRecurring && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-primary">
                  <Repeat2 className="size-2.5" />
                  Recorrente
                </span>
              )}
            </span>
          }
        />
        <InfoRow
          icon={<CalendarDays className="size-4" />}
          label="Data solicitada"
          value={scheduledAtLabel}
        />
      </div>

      {notes && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-border/70 bg-background p-3.5">
          <Quote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              Observações do tutor
            </p>
            <p className="text-sm leading-relaxed text-foreground/80">{notes}</p>
          </div>
        </div>
      )}
    </section>
  )
}
