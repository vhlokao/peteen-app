import type { ReactNode } from "react";

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
