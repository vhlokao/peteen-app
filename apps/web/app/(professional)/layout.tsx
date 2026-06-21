import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function ProfessionalLayout({ children }: { children: ReactNode }) {
  return <AppShell variant="professional">{children}</AppShell>;
}
