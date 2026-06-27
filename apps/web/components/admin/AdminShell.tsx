/**
 * AdminShell — layout desktop-first para o Backoffice Admin.
 *
 * Server Component:
 *   - Valida role ADMIN (redirect /dashboard se não autorizado)
 *   - Compõe sidebar + topbar + conteúdo
 *   - Desktop-first: sidebar lateral fixa, sem BottomNav mobile
 */

import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { LogOut, Shield } from "lucide-react"

import { getAuthContext } from "@/modules/identity/application/get-session"
import { getAdminNotificationCountAction } from "@/modules/notifications/application/actions"
import { NotificationBell } from "@/modules/notifications/components/notification-bell"
import { AdminNav } from "./AdminNav"

type AdminShellProps = {
  children: ReactNode
}

export async function AdminShell({ children }: AdminShellProps) {
  // ── Guard: somente ADMIN ────────────────────────────────────────────────────
  const ctx = await getAuthContext()

  if (!ctx.authenticated) {
    redirect("/login")
  }

  if (!ctx.user.roles.includes("ADMIN")) {
    redirect("/dashboard")
  }

  const { email } = ctx.user
  const notificationCount = await getAdminNotificationCountAction()

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/10">
        {/* Logo / Identidade */}
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <Shield className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Admin</span>
          <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Peteen
          </span>
        </div>

        {/* Navegação */}
        <div className="flex-1 overflow-y-auto">
          <AdminNav />
        </div>

        {/* Rodapé do sidebar */}
        <div className="border-t px-4 py-3">
          <p className="truncate text-[0.65rem] text-muted-foreground">{email}</p>
          <Link
            href="/api/auth/logout"
            className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sair
          </Link>
        </div>
      </aside>

      {/* ── Área principal ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-6">
          <span className="text-xs text-muted-foreground">
            Backoffice operacional
          </span>
          <div className="flex items-center gap-3">
            <NotificationBell
              href="/admin/notifications"
              count={notificationCount}
              showLabel
            />
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              {process.env.NODE_ENV === "development" ? "dev" : "prod"}
            </span>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
