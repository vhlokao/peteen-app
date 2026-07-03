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
    <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative h-20 bg-primary sm:h-24">
        <div
          className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-8 left-1/3 size-20 rounded-full bg-white/10"
          aria-hidden
        />
      </div>

      <div className="px-5 pb-5">
        <Avatar className="-mt-10 size-20 shrink-0 rounded-2xl border-4 border-card shadow-sm sm:size-24">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="text-xl font-bold leading-tight text-foreground">{displayName}</h1>
            {isVerified && (
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-label="Verificado" />
            )}
          </div>
          {primaryService && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {SERVICE_TYPE_LABELS[primaryService]}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
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
