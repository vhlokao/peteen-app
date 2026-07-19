import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { resolvePublicPageBackLink } from "@/modules/partner-portal/domain/navigation"

type BackButtonProps = {
  searchParams: { from?: string | string[]; returnTo?: string | string[] }
  fallbackHref: string
}

/**
 * Botão Voltar do perfil público — visual navy circular do redesign, mas
 * reaproveita resolvePublicPageBackLink (mesma função pura usada por
 * PublicPageBackLink) para o roteamento contextual real via from/returnTo
 * — ex.: parceiro/profissional voltando pro próprio portal.
 *
 * Não usa useRouter().back(): perderia esse contexto entre portais.
 * PublicPageBackLink em si não foi tocado — é compartilhado com
 * app/(marketing)/partners/[slug]/page.tsx.
 */
export function BackButton({ searchParams, fallbackHref }: BackButtonProps) {
  const portalBack = resolvePublicPageBackLink(searchParams)

  return (
    <Link
      href={portalBack?.href ?? fallbackHref}
      aria-label={portalBack?.label ?? "Voltar"}
      className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-white/[.12] text-white transition-colors hover:bg-white/[.18]"
    >
      <ChevronLeft className="size-5" />
    </Link>
  )
}
