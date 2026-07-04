import type { ReactNode } from "react"

import { requireAreaRole } from "@/modules/identity/application/require-area-role"

/**
 * Guard automático de área — exige role PARTNER para tudo em /partner/*.
 * O gate de vínculo (linkedPartnerId) continua em requirePartnerContext e
 * em /partner/pending — este guard só cobre "tem a role", não "está vinculado".
 */
export default async function PartnerAreaLayout({ children }: { children: ReactNode }) {
  await requireAreaRole("PARTNER")
  return <>{children}</>
}
