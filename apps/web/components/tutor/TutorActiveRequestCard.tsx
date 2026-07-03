import Link from "next/link"
import { Clock } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export type TutorActiveRequestSummary = {
  id: string
  professionalName: string
  professionalCity: string
  professionalAvatarUrl: string | null
  serviceLabel: string
  statusLabel: string
  statusTone: "pending" | "accepted" | "in_progress"
  petName: string | null
}

const STATUS_TONE_CLASS: Record<TutorActiveRequestSummary["statusTone"], string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-primary/10 text-primary",
  in_progress: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
}

/**
 * Card de solicitação em andamento — só renderiza se houver dado real
 * (filtrado em app/(tutor)/tutor/page.tsx a partir de getMyRequestsAsTutorAction,
 * Server Action já existente). Nunca inventa estado.
 */
export function TutorActiveRequestCard({
  request,
}: {
  request: TutorActiveRequestSummary
}) {
  const initials = request.professionalName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">Em andamento</h2>
      <Link
        href={`/tutor/requests/${request.id}`}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATUS_TONE_CLASS[request.statusTone]
            )}
          >
            <Clock className="size-3" />
            {request.statusLabel}
          </span>
          <span className="text-xs text-muted-foreground">{request.serviceLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {request.professionalAvatarUrl && (
              <AvatarImage src={request.professionalAvatarUrl} alt={request.professionalName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {request.professionalName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {request.petName ? `Para ${request.petName} · ` : ""}
              {request.professionalCity}
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-primary">Acompanhar →</span>
        </div>
      </Link>
    </section>
  )
}
