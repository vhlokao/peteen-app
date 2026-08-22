import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AdminShell } from "@/components/admin/AdminShell"
import { PRIVATE_AREA_METADATA } from "@/lib/seo/private-area"

/** Backoffice — nunca indexado. Ver lib/seo/private-area.ts. */
export const metadata: Metadata = PRIVATE_AREA_METADATA

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
