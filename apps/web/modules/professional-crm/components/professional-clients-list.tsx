import Link from "next/link"
import { CalendarDays, MapPin, PawPrint } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RELATIONSHIP_LEVEL_ICONS } from "@/modules/relationship/domain/constants"
import type { RelationshipLevel } from "@/modules/relationship/domain/types"
import type { ProfessionalClientRow } from "../domain/types"

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

/**
 * Cliente como relação, não registro de CRM — pill de nível já é o rótulo
 * humano central (RELATIONSHIP_LEVEL_LABELS), sem score exposto.
 */
export function ProfessionalClientsList({ clients }: { clients: ProfessionalClientRow[] }) {
  if (clients.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {clients.map((client) => {
        const level = client.relationshipLevel as RelationshipLevel
        const initials = client.tutorName
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase()

        return (
          <Link
            key={client.tutorId}
            href={`/professional/clients/${client.tutorId}`}
            className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
          >
            <div className="flex items-start gap-3">
              <Avatar className="size-11 shrink-0 rounded-xl">
                <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{client.tutorName}</p>
                {client.city && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{client.city}</span>
                  </div>
                )}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary">
                <span aria-hidden>{RELATIONSHIP_LEVEL_ICONS[level]}</span>
                {client.relationshipLevelLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {client.totalServices} atendimento{client.totalServices !== 1 ? "s" : ""}
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3 shrink-0" />
                Último: {formatDate(client.lastServiceAt)}
              </span>
            </div>

            {client.petNames.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PawPrint className="size-3 shrink-0" />
                {client.petNames.join(", ")}
              </p>
            )}

            <span className="mt-auto self-start text-xs font-medium text-primary">
              Ver histórico →
            </span>
          </Link>
        )
      })}
    </div>
  )
}
