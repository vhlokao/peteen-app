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
  "/partner/notifications",
] as const

export type PartnerPortalReturnPath = (typeof PARTNER_PORTAL_RETURN_PATHS)[number]

export type PortalKind = "partner" | "tutor" | "professional"

const PORTAL_KINDS: PortalKind[] = ["partner", "tutor", "professional"]

const PORTAL_DEFAULTS: Record<PortalKind, string> = {
  partner: "/partner",
  tutor: "/tutor",
  professional: "/professional",
}

const PORTAL_BACK_LABELS: Record<PortalKind, string> = {
  partner: "Voltar ao portal parceiro",
  tutor: "Voltar",
  professional: "Voltar ao portal profissional",
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
      "/tutor/notifications",
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
      "/professional/notifications",
      "/professional/clients",
      "/professional/pets",
    ],
    prefixes: ["/professional/clients/"],
  },
}

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://")
}

/** Decodifica returnTo vindo de query string (inclui %2F...) sem quebrar paths válidos */
export function normalizeReturnPath(path?: string | null): string | undefined {
  if (!path) return undefined
  let current = path.trim()
  if (!current) return undefined

  for (let i = 0; i < 2; i++) {
    if (!current.includes("%")) break
    try {
      const decoded = decodeURIComponent(current)
      if (decoded === current) break
      current = decoded
    } catch {
      break
    }
  }

  return isSafeInternalPath(current) ? current : undefined
}

function isPortalKind(value: string): value is PortalKind {
  return (PORTAL_KINDS as readonly string[]).includes(value)
}

export function isPartnerPortalReturnPath(path: string): path is PartnerPortalReturnPath {
  const normalized = normalizeReturnPath(path)
  if (!normalized) return false
  return (PARTNER_PORTAL_RETURN_PATHS as readonly string[]).includes(normalized)
}

export function isValidPortalReturnPath(kind: PortalKind, path: string): boolean {
  const normalized = normalizeReturnPath(path)
  if (!normalized || !isSafeInternalPath(normalized)) return false
  const rules = PORTAL_RETURN_RULES[kind]
  if ((rules.exact as readonly string[]).includes(normalized)) return true
  return rules.prefixes.some((prefix) => normalized.startsWith(prefix))
}

function normalizeParam(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return normalizeReturnPath(value[0])
  return normalizeReturnPath(value)
}

export function buildDiscoverUrl(
  professionalId: string,
  options: { from: PortalKind; returnTo?: string }
): string {
  const id = professionalId?.trim()
  if (!id) {
    return PORTAL_DEFAULTS[options.from]
  }

  const normalizedReturnTo = normalizeReturnPath(options.returnTo)
  const returnTo =
    normalizedReturnTo && isValidPortalReturnPath(options.from, normalizedReturnTo)
      ? normalizedReturnTo
      : PORTAL_DEFAULTS[options.from]

  const params = new URLSearchParams({ from: options.from, returnTo })
  return `/discover/${encodeURIComponent(id)}?${params.toString()}`
}

export function buildPartnerPublicUrl(
  slug: string,
  returnTo: PartnerPortalReturnPath = "/partner"
): string {
  const normalizedSlug = slug?.trim()
  if (!normalizedSlug) return "/partner"

  const params = new URLSearchParams({ from: "partner", returnTo })
  return `/partners/${encodeURIComponent(normalizedSlug)}?${params.toString()}`
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
    return { href, label: PORTAL_BACK_LABELS[from] }
  }

  if (returnTo) {
    for (const kind of PORTAL_KINDS) {
      if (isValidPortalReturnPath(kind, returnTo)) {
        return { href: returnTo, label: PORTAL_BACK_LABELS[kind] }
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
  const normalizedReturnTo = normalizeReturnPath(input.returnTo)
  if (normalizedReturnTo) url.searchParams.set("returnTo", normalizedReturnTo)
  return `${url.pathname}${url.search}`
}
