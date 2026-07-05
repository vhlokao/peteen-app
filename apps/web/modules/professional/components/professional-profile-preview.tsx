import Link from "next/link"
import { ExternalLink, MapPin, ShieldCheck } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"
import {
  SERVICE_TYPE_LABELS,
  TRUST_LEVEL_LABELS,
  type ProfessionalProfileData,
} from "@/modules/professional/domain/types"
import { resolvePublicLocation } from "@/modules/location"

/**
 * Como o profissional aparece para o tutor — sem score bruto isolado, só
 * o essencial do preview público.
 */
export function ProfessionalProfilePreview({ profile }: { profile: ProfessionalProfileData }) {
  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const mainService = profile.serviceTypes[0]

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <Avatar className="size-14 shrink-0 rounded-xl">
          {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />}
          <AvatarFallback className="rounded-xl bg-primary/10 text-base font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{profile.displayName}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">
              {resolvePublicLocation({ city: profile.city, state: profile.state }).label}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mainService && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary">
            {SERVICE_TYPE_LABELS[mainService]}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
          {TRUST_LEVEL_LABELS[profile.trustLevel]}
        </span>
        {profile.isVerified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-success">
            <ShieldCheck className="size-3" />
            Verificado
          </span>
        )}
      </div>

      <Link
        href={buildDiscoverUrl(profile.id, { from: "professional", returnTo: "/professional/profile" })}
        target="_blank"
        className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border/70 px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/25"
      >
        Ver perfil público
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
      </Link>
    </section>
  )
}
