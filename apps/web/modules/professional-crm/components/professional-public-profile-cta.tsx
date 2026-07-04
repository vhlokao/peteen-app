import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"

export function ProfessionalPublicProfileCTA({ professionalId }: { professionalId: string }) {
  return (
    <Link
      href={buildDiscoverUrl(professionalId, { from: "professional", returnTo: "/professional" })}
      target="_blank"
      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-primary/25"
    >
      <span className="text-sm font-medium text-foreground">Ver meu perfil público</span>
      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
