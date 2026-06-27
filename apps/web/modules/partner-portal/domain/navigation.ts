/**
 * Módulo: partner-portal
 * Camada: domain — URLs de navegação com contexto de portal (tutor, profissional, parceiro)
 */

export const PARTNER_PORTAL_RETURN_PATHS = [
  "/partner",
  "/partner/recommendations",
  "/partner/metrics",
  "/partner/profile",
  "/partner/activity",
] as const

export type PartnerPortalReturnPath = (typeof PARTNER_PORTAL_RETURN_PATHS)[number]

export type PortalKind = "partner" | "tutor" | "professional"

const PORTAL_KINDS: PortalKind[] = ["partner", "tutor", "professional"]

const PORTAL_DEFAULTS: Record<PortalKind, string> = {
  partner: "/partner",
  tutor: "/tutor",
  professional: "/professional",
}

const PORTAL_RETURN_RULES: Record<
  PortalKind,
  { exact: readonly string[]; prefixes: readonly string[] }
> = {
  partner: { exact: PARTNER_PORTAL_RETURN_PATHS, prefixes: [] },
  tutor: {
    exact: [
      "/tutor",
      "/tutor/buscar",
      "/tutor/perfil",
      "/tutor/activity",
      "/tutor/requests",
      "/tutor/pets",
    ],
    prefixes: ["/tutor/requests/", "/tutor/professionals/"],
  },
  professional: {
    exact: [
      "/professional",
      "/professional/profile",
      "/professional/services",
      "/professional/reviews",
      "/professional/metricas",
      "/professional/activity",
      "/professional/clients",
      "/professional/pets",
    ],
    prefixes: ["/professional/clients/"],
  },
}

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://")
}

function isPortalKind(value: string): value is PortalKind {
  return (PORTAL_KINDS as readonly string[]).includes(value)
}

export function isPartnerPortalReturnPath(path: string): path is PartnerPortalReturnPath {
  return (PARTNER_PORTAL_RETURN_PATHS as readonly string[]).includes(path)
}

export function isValidPortalReturnPath(kind: PortalKind, path: string): boolean {
  if (!isSafeInternalPath(path)) return false
  const rules = PORTAL_RETURN_RULES[kind]
  if ((rules.exact as readonly string[]).includes(path)) return true
  return rules.prefixes.some((prefix) => path.startsWith(prefix))
}

function normalizeParam(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function buildDiscoverUrl(
  professionalId: string,
  options: { from: PortalKind; returnTo?: string }
): string {
  const returnTo =
    options.returnTo && isValidPortalReturnPath(options.from, options.returnTo)
      ? options.returnTo
      : PORTAL_DEFAULTS[options.from]

  const params = new URLSearchParams({ from: options.from, returnTo })
  return `/discover/${professionalId}?${params.toString()}`
}

export function buildPartnerPublicUrl(
  slug: string,
  returnTo: PartnerPortalReturnPath = "/partner"
): string {
  const params = new URLSearchParams({ from: "partner", returnTo })
  return `/partners/${slug}?${params.toString()}`
}

/** @deprecated Use buildDiscoverUrl({ from: "partner", returnTo }) */
export function buildProfessionalDiscoverUrl(
  professionalId: string,
  returnTo: PartnerPortalReturnPath = "/partner/recommendations"
): string {
  return buildDiscoverUrl(professionalId, { from: "partner", returnTo })
}

export function resolvePublicPageBackLink(input: {
  from?: string | string[]
  returnTo?: string | string[]
}): { href: string; label: string } | null {
  const from = normalizeParam(input.from)
  const returnTo = normalizeParam(input.returnTo)

  if (from && isPortalKind(from)) {
    const href =
      returnTo && isValidPortalReturnPath(from, returnTo)
        ? returnTo
        : PORTAL_DEFAULTS[from]
    return { href, label: "Voltar" }
  }

  if (returnTo) {
    for (const kind of PORTAL_KINDS) {
      if (isValidPortalReturnPath(kind, returnTo)) {
        return { href: returnTo, label: "Voltar" }
      }
    }
  }

  return null
}

/** @deprecated Use resolvePublicPageBackLink */
export function resolvePartnerPortalBackLink(input: {
  from?: string | string[]
  returnTo?: string | string[]
}): string | null {
  return resolvePublicPageBackLink(input)?.href ?? null
}

export function appendPortalContextToHref(
  href: string,
  input: { from?: string; returnTo?: string }
): string {
  if (!input.from && !input.returnTo) return href
  const url = new URL(href, "http://local")
  if (input.from) url.searchParams.set("from", input.from)
  if (input.returnTo) url.searchParams.set("returnTo", input.returnTo)
  return `${url.pathname}${url.search}`
}
