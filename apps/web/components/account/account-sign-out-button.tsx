"use client"

import { useRouter } from "next/navigation"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { revogarPushAntesDoLogout } from "@/lib/push/logout"
import { Button } from "@/components/ui/button"

/**
 * Sair da conta — ação canônica única, usada pela página Conta/Configurações
 * de cada persona. Mesmo padrão já validado em AvatarMenu/AccountMenuContent
 * (revogar push → unsubscribe local → signOut escopo "local" → /login).
 *
 * Substitui ProfessionalProfileSignOutButton, que vivia solto na página de
 * Perfil — Sair não é dado de identidade, não pertence lá (UX R1).
 */
export function AccountSignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await revogarPushAntesDoLogout()

    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut({ scope: "local" })
    router.push("/login")
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
      onClick={handleSignOut}
    >
      Sair da conta
    </Button>
  )
}
