/**
 * Módulo: identity
 * Camada: application — guard automático de área por role (layout-level)
 *
 * Usado pelos layouts aninhados de (tutor)/tutor, (professional)/professional
 * e (partner)/partner para garantir que uma nova page criada dentro dessas
 * pastas herde proteção por role sem precisar chamar require*Context
 * manualmente. require*Context e requireRole continuam existindo como
 * defesa em profundidade nas Server Actions.
 */

import { redirect } from "next/navigation"

import { getAuthContext } from "./get-session"
import { resolveHomeForRoles } from "../domain/role-routing"
import type { PersonaRole, SessionUser } from "../domain/types"

export async function requireAreaRole(role: PersonaRole): Promise<SessionUser> {
  const ctx = await getAuthContext()

  if (!ctx.authenticated) {
    redirect("/login")
  }

  const session = ctx.user

  if (!session.roles.includes(role)) {
    redirect(resolveHomeForRoles(session.roles, session.primaryRole))
  }

  return session
}
