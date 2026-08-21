import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"
import { ShareProfileButton } from "@/modules/invite/components/share-profile-button"

/**
 * Bloco de presença pública no dashboard — ver o próprio perfil e convidar
 * tutores.
 *
 * O compartilhamento vive aqui e na página de perfil, e em nenhum outro
 * lugar: são os dois pontos em que o profissional já está pensando na
 * própria presença. Espalhar o botão pelo app o transformaria em ruído.
 */
export function ProfessionalPublicProfileCTA({
  professionalId,
  professionalName,
}: {
  professionalId: string
  professionalName: string
}) {
  return (
    <div className="space-y-2">
      <Link
        href={buildDiscoverUrl(professionalId, { from: "professional", returnTo: "/professional" })}
        target="_blank"
        className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-primary/25"
      >
        <span className="text-sm font-medium text-foreground">Ver meu perfil público</span>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <ShareProfileButton
        professionalId={professionalId}
        professionalName={professionalName}
        className="w-full"
      />
    </div>
  )
}
