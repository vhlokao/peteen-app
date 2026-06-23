import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { resolvePartnerPortalBackLink } from "../domain/navigation"

type PublicPageBackLinkProps = {
  searchParams: { from?: string | string[]; returnTo?: string | string[] }
  fallbackHref: string
  fallbackLabel: string
}

export function PublicPageBackLink({
  searchParams,
  fallbackHref,
  fallbackLabel,
}: PublicPageBackLinkProps) {
  const partnerBack = resolvePartnerPortalBackLink(searchParams)

  return (
    <Link
      href={partnerBack ?? fallbackHref}
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {partnerBack ? "Voltar ao portal parceiro" : fallbackLabel}
    </Link>
  )
}
