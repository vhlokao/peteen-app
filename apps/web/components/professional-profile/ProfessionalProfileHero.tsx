import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { resolvePublicLocation } from "@/modules/location"

const NAVY = "#1D2F6F"
const GREEN = "#40916C"

type ProfessionalProfileHeroProps = {
  displayName: string
  avatarUrl: string | null
  city: string
  state: string
  primaryService: ServiceType | null
  isVerified: boolean
}

/**
 * Identidade do profissional — avatar + nome + verificado + serviço + cidade.
 * Renderizado dentro da capa navy da página (sem fundo/borda próprios;
 * texto em branco).
 */
export function ProfessionalProfileHero({
  displayName,
  avatarUrl,
  city,
  state,
  primaryService,
  isVerified,
}: ProfessionalProfileHeroProps) {
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="flex items-center gap-4">
      <span
        className="relative grid size-[76px] shrink-0 place-items-center rounded-[22px] text-[26px] font-extrabold"
        style={{ background: "linear-gradient(135deg,#E8EEF6,#D7E2F2)", color: NAVY }}
      >
        <Avatar className="size-full rounded-[22px] bg-transparent">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="rounded-[22px] bg-transparent text-[26px] font-extrabold" style={{ color: NAVY }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {isVerified && (
          <span
            className="absolute -bottom-1.5 -right-1.5 grid size-[26px] place-items-center rounded-full border-[3px]"
            style={{ borderColor: NAVY, background: GREEN }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="size-[13px]" aria-hidden>
              <path d="m5 12 4 4 10-10" />
            </svg>
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[21px] font-extrabold tracking-[-0.02em] text-white">
          {displayName}
        </h1>
        {primaryService && (
          <p className="text-[13px] text-white/70">{SERVICE_TYPE_LABELS[primaryService]}</p>
        )}
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/60">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="2.6" />
          </svg>
          {resolvePublicLocation({ city, state }).label}
        </p>
      </div>
    </div>
  )
}
