import type { ReactNode } from "react"

import { requireAreaRole } from "@/modules/identity/application/require-area-role"

/**
 * Guard automático de área — exige role TUTOR para tudo em /tutor/*.
 * Escopo: só este subtree (não /discover nem /me, que ficam acessíveis
 * a qualquer persona autenticada dentro do route group (tutor)).
 */
export default async function TutorAreaLayout({ children }: { children: ReactNode }) {
  await requireAreaRole("TUTOR")
  return <>{children}</>
}
