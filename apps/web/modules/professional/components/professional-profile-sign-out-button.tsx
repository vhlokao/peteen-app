"use client"

import { useRouter } from "next/navigation"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { revogarPushAntesDoLogout } from "@/lib/push/logout"
import { Button } from "@/components/ui/button"

/**
 * Sair da conta — mesmo padrão real já usado em AvatarMenu/AdminSignOutButton
 * (supabase.auth.signOut() + redirect para /login + refresh). Extraído em
 * Client Component próprio porque a página de perfil é Server Component.
 */
export function ProfessionalProfileSignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    // Ordem obrigatória: revogar push (autenticado) → unsubscribe no browser →
    // signOut. Best-effort com timeout — nunca bloqueia o logout.
    await revogarPushAntesDoLogout()

    const supabase = createSupabaseBrowserClient()
    // scope "local" — o default global derrubaria as sessões dos outros
    // dispositivos deste usuário.
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
