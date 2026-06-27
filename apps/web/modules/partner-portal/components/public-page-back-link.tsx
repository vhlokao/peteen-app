import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { resolvePublicPageBackLink } from "../domain/navigation"

type PublicPageBackLinkProps = {
  searchParams: { from?: string | string[]; returnTo?: string | string[] }
  fallbackHref: string
  fallbackLabel?: string
}

export function PublicPageBackLink({
  searchParams,
  fallbackHref,
  fallbackLabel = "Voltar",
}: PublicPageBackLinkProps) {
  const portalBack = resolvePublicPageBackLink(searchParams)

  return (
    <Link
      href={portalBack?.href ?? fallbackHref}
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {portalBack?.label ?? fallbackLabel}
    </Link>
  )
}
