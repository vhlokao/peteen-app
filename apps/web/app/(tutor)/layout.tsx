import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function TutorLayout({ children }: { children: ReactNode }) {
  return <AppShell variant="tutor">{children}</AppShell>;
}
