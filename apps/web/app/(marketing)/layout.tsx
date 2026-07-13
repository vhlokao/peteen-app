import type { ReactNode } from "react";

/**
 * Layout do grupo (marketing) — passthrough.
 *
 * A home pública (page.tsx) traz nav e footer próprios, então NÃO usa AppShell
 * (evita TopBar duplicada). Páginas que ainda precisam da TopBar da Peteen
 * — ex.: partners/[slug] — envolvem o próprio conteúdo em <AppShell> localmente.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
