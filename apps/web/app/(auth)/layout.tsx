import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PRIVATE_AREA_METADATA } from "@/lib/seo/private-area";

/** Login não é conteúdo público. Ver lib/seo/private-area.ts. */
export const metadata: Metadata = PRIVATE_AREA_METADATA;

/**
 * Layout do grupo (auth) — passthrough.
 *
 * LoginForm possui seu próprio wrapper de página inteira (background,
 * centralização, hero), então este layout não deve competir com isso —
 * mesmo padrão adotado em (marketing)/layout.tsx.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
