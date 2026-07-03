import { MapPin, ShieldCheck } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"

type ProfessionalProfileHeroProps = {
  displayName: string
  avatarUrl: string | null
  city: string
  state: string
  primaryService: ServiceType | null
  isVerified: boolean
}

/**
 * Hero do perfil público — faixa azul + avatar sobreposto.
 * Sem foto real: fallback com iniciais sobre bg-primary/10, nunca quebrado.
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
    <div className="mb-5 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-card)]">
      <div className="relative h-24 bg-gradient-to-br from-primary via-primary to-[oklch(0.34_0.11_266)] sm:h-28">
        <div
          className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10 blur-[2px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/3 size-24 rounded-full bg-white/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"
          aria-hidden
        />
      </div>

      <div className="px-5 pb-5">
        <Avatar className="-mt-11 size-20 shrink-0 rounded-2xl border-4 border-card shadow-[var(--shadow-card)] sm:size-24">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{displayName}</h1>
            {isVerified && (
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-label="Verificado" />
            )}
          </div>
          {primaryService && (
            <span className="mt-1.5 inline-flex w-fit items-center rounded-md bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary">
              {SERVICE_TYPE_LABELS[primaryService]}
            </span>
          )}
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span>
              {city}, {state}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
