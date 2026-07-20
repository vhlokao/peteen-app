"use client"

import { useRouter } from "next/navigation"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

/**
 * Sair da conta — mesmo padrão real já usado em AvatarMenu/AdminSignOutButton
 * (supabase.auth.signOut() + redirect para /login + refresh). Extraído em
 * Client Component próprio porque a página de perfil é Server Component.
 */
export function ProfessionalProfileSignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
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
