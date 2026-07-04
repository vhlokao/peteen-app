"use client"

/**
 * AdminSignOutButton — logout do backoffice admin.
 *
 * AdminShell é Server Component e não usa AvatarMenu (sidebar própria,
 * distinta do TopBar dos demais portais) — mas o mecanismo de logout é o
 * mesmo já usado e funcional em toda a aplicação (ver
 * components/layout/avatar-menu.tsx): encerrar sessão via cliente Supabase
 * do browser, depois navegar para /login com refresh do router para limpar
 * qualquer estado de sessão em cache.
 */

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export function AdminSignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <LogOut className="size-3.5" />
      Sair
    </button>
  )
}
