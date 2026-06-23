/**
 * Módulo: partner-portal
 * Camada: domain — URLs de navegação com contexto do portal
 */

export const PARTNER_PORTAL_RETURN_PATHS = [
  "/partner",
  "/partner/recommendations",
  "/partner/metrics",
  "/partner/profile",
] as const

export type PartnerPortalReturnPath = (typeof PARTNER_PORTAL_RETURN_PATHS)[number]

function isPartnerPortalReturnPath(path: string): path is PartnerPortalReturnPath {
  return (PARTNER_PORTAL_RETURN_PATHS as readonly string[]).includes(path)
}

export function buildPartnerPublicUrl(
  slug: string,
  returnTo: PartnerPortalReturnPath = "/partner"
): string {
  const params = new URLSearchParams({ from: "partner", returnTo })
  return `/partners/${slug}?${params.toString()}`
}

export function buildProfessionalDiscoverUrl(
  professionalId: string,
  returnTo: PartnerPortalReturnPath = "/partner/recommendations"
): string {
  const params = new URLSearchParams({ from: "partner", returnTo })
  return `/discover/${professionalId}?${params.toString()}`
}

export function resolvePartnerPortalBackLink(input: {
  from?: string | string[]
  returnTo?: string | string[]
}): string | null {
  const from = Array.isArray(input.from) ? input.from[0] : input.from
  const returnTo = Array.isArray(input.returnTo) ? input.returnTo[0] : input.returnTo

  if (from !== "partner" && !returnTo) return null

  if (returnTo && isPartnerPortalReturnPath(returnTo)) {
    return returnTo
  }

  if (from === "partner") return "/partner"

  return null
}
