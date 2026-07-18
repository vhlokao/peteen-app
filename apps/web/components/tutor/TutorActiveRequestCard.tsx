import Link from "next/link"
import { ChevronRight, PawPrint } from "lucide-react"

const NAVY = "#1D2F6F"
const CORAL = "#E07A5F"

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

const STATUS_TONE: Record<
  TutorActiveRequestSummary["statusTone"],
  { dot: string; bg: string; fg: string }
> = {
  accepted: { dot: "#5AD293", bg: "rgba(64,145,108,.22)", fg: "#8FE3B8" },
  pending: { dot: "#F0B84C", bg: "rgba(240,184,76,.22)", fg: "#F5CE86" },
  in_progress: { dot: "#8FB0E8", bg: "rgba(110,198,255,.20)", fg: "#B7D9F5" },
}

/**
 * Card de solicitação em andamento — só renderiza com dado real (filtrado
 * em app/(tutor)/tutor/page.tsx a partir de getMyRequestsAsTutorAction,
 * Server Action já existente). Nunca inventa estado; statusLabel vem do
 * servidor (REQUEST_STATUS_LABELS), só a cor é derivada de statusTone.
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

  const tone = STATUS_TONE[request.statusTone]

  return (
    <Link
      href={`/tutor/requests/${request.id}`}
      className="relative block overflow-hidden rounded-[22px] p-5 shadow-[0_18px_34px_-16px_rgba(29,47,111,.6)]"
      style={{ background: NAVY }}
    >
      <span
        className="pointer-events-none absolute -top-[60px] -right-[40px] size-[150px] rounded-full bg-[#6EC6FF]/[.14]"
        aria-hidden
      />

      <div className="relative mb-4 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[11.5px] font-bold"
          style={{ background: tone.bg, color: tone.fg }}
        >
          <span className="size-1.5 rounded-full" style={{ background: tone.dot }} />
          {request.statusLabel}
        </span>
        <span className="text-[12.5px] font-semibold text-white/70">
          {request.serviceLabel}
        </span>
      </div>

      <div className="relative flex items-center gap-3.5">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#E8EEF6] text-[15px] font-bold"
          style={{ color: NAVY }}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-bold text-white">
            {request.professionalName}
          </p>
          <p className="truncate text-[13px] text-white/70">
            {request.petName ? `Para ${request.petName} · ` : ""}
            {request.professionalCity}
          </p>
        </div>
      </div>

      <span
        className="relative mt-4 block w-full rounded-[13px] bg-white py-3 text-center text-[13.5px] font-bold"
        style={{ color: NAVY }}
      >
        Ver detalhes
      </span>
    </Link>
  )
}

/**
 * Estado vazio — sem solicitação ativa. Não inventa dado, só convida a
 * agendar o primeiro atendimento.
 */
export function TutorEmptyActiveRequestCard() {
  return (
    <Link
      href="/discover"
      className="flex w-full items-center gap-3.5 rounded-[22px] border-[1.5px] border-dashed border-border bg-card p-5 text-left"
    >
      <span
        className="grid size-[46px] shrink-0 place-items-center rounded-[14px]"
        style={{ background: "#FBEDE8", color: CORAL }}
      >
        <PawPrint className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-foreground">
          Que tal agendar o primeiro passeio?
        </span>
        <span className="block text-[12.5px] text-muted-foreground">
          Encontre alguém de confiança para começar.
        </span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" />
    </Link>
  )
}
