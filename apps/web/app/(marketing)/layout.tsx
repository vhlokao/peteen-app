import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <AppShell variant="marketing">{children}</AppShell>;
}
