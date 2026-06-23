import type { ReactNode } from "react"

import { AppShell } from "@/components/layout/app-shell"

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return <AppShell variant="partner">{children}</AppShell>
}
