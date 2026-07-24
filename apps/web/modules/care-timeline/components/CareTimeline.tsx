"use client"

/**
 * CareTimeline — visualização read-only da timeline de cuidado.
 *
 * O servidor busca (getCareTimelineAction) e passa `updates` já ordenados por
 * occurredAt ASC. A formatação de horário é feita no client, no fuso do viewer
 * (decisão V0: armazenar UTC, renderizar local).
 */

import {
  DoorOpen,
  DoorClosed,
  UtensilsCrossed,
  Footprints,
  Sparkles,
  Moon,
  StickyNote,
  type LucideIcon,
} from "lucide-react"

import {
  CARE_CATEGORY_LABELS,
  type CareUpdate,
  type CareUpdateCategory,
} from "../domain/types"

const CATEGORY_ICON: Record<CareUpdateCategory, LucideIcon> = {
  CHECK_IN: DoorOpen,
  FEEDING: UtensilsCrossed,
  WALK: Footprints,
  ACTIVITY: Sparkles,
  REST: Moon,
  NOTE: StickyNote,
  CHECK_OUT: DoorClosed,
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function CareTimeline({ updates }: { updates: CareUpdate[] }) {
  if (updates.length === 0) {
    return (
      <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhuma atualização ainda.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {updates.map((update) => {
        const Icon = CATEGORY_ICON[update.category]
        return (
          <li
            key={update.id}
            className="flex gap-3 rounded-xl border border-border/70 bg-card p-3.5"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-foreground">
                  {CARE_CATEGORY_LABELS[update.category]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(update.occurredAt)}
                  {update.editedAt ? " · editado" : null}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                {update.content}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
