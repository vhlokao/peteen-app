import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-[var(--page-padding-x)] py-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
