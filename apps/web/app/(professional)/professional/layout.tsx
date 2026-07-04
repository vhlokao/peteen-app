import type { ReactNode } from "react"

import { requireAreaRole } from "@/modules/identity/application/require-area-role"

/**
 * Guard automático de área — exige role PROFESSIONAL para tudo em
 * /professional/*. Escopo: só este subtree (não /requests, que é
 * compartilhado e tem sua própria lógica de role em page.tsx).
 */
export default async function ProfessionalAreaLayout({ children }: { children: ReactNode }) {
  await requireAreaRole("PROFESSIONAL")
  return <>{children}</>
}
