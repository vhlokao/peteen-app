/**
 * Módulo: identity
 * Camada: domain — resolução de destino seguro por role
 *
 * Centraliza a lógica de "para onde mandar um usuário que está na área
 * errada". Usado pelos guards de layout/contexto para evitar redirects
 * fixos divergentes entre TUTOR/PROFESSIONAL/PARTNER.
 */

import type { PersonaRole } from "./types"

const ROLE_HOME: Record<PersonaRole, string> = {
  TUTOR: "/tutor",
  PROFESSIONAL: "/professional",
  PARTNER: "/partner",
  ADMIN: "/admin",
}

/**
 * resolveHomeForRoles — decide o destino seguro para um usuário autenticado
 * que não tem a role exigida pela área atual.
 *
 * Prioridade:
 *   1. primaryRole, se ele estiver de fato entre as roles que o usuário possui
 *   2. primeira role de negócio (TUTOR/PROFESSIONAL/PARTNER) presente em roles
 *   3. ADMIN, se presente
 *   4. /login como fallback seguro (não deveria ocorrer para quem já passou
 *      pelo guard de autenticação, mas evita redirect para undefined)
 */
export function resolveHomeForRoles(
  roles: PersonaRole[],
  primaryRole: PersonaRole | null
): string {
  if (primaryRole && roles.includes(primaryRole)) {
    return ROLE_HOME[primaryRole]
  }

  const businessRole = roles.find((role) => role !== "ADMIN")
  if (businessRole) {
    return ROLE_HOME[businessRole]
  }

  if (roles.includes("ADMIN")) {
    return ROLE_HOME.ADMIN
  }

  return "/login"
}
