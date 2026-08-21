"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { executarLogout } from "@/lib/push/sign-out"
import { Button } from "@/components/ui/button"

/**
 * Sair da conta — ação canônica da página Minha conta.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE O AVISO SOBRE NOTIFICAÇÕES
 *
 * Sair revoga a subscription de push DESTE dispositivo (ver lib/push/logout.ts
 * — é a única janela com sessão válida para revogar de forma autenticada).
 * Entrar de novo NÃO recria a subscription sozinha: o usuário precisa reativar
 * as notificações. Até aqui isso acontecia de forma completamente silenciosa,
 * e o efeito é indistinguível de "o push parou de funcionar".
 *
 * Este não é um risco teórico — uma investigação anterior de push não
 * entregue terminou exatamente numa subscription revogada com motivo
 * "logout". Dizer a frase antes do clique é a correção mais barata possível,
 * e não altera nenhum contrato de push.
 *
 * ESTADO PENDING: o logout faz até três round-trips (revogar, unsubscribe,
 * signOut) antes de navegar. Sem `pending`, o botão fica parado por
 * centésimos que parecem "não reagiu" — e um segundo clique dispararia a
 * sequência de novo, agora possivelmente sem sessão.
 */
export function AccountSignOutButton() {
  const router = useRouter()
  const [saindo, setSaindo] = useState(false)

  async function handleSignOut() {
    if (saindo) return
    setSaindo(true)
    try {
      await executarLogout()
      router.push("/login")
      router.refresh()
    } catch {
      // `executarLogout` é best-effort e não lança; este catch existe só para
      // que uma falha inesperada não deixe o botão travado em "Saindo…".
      setSaindo(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        // `touch-target` (utility do design system, 44px): o tamanho padrão do
        // Button é h-8 = 32px, abaixo do alvo mínimo de toque — inaceitável
        // numa ação destrutiva, ainda mais em 320px.
        className="touch-target w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={handleSignOut}
        disabled={saindo}
        pending={saindo}
        pendingText="Saindo…"
      >
        <LogOut className="size-4" />
        Sair da conta
      </Button>
      <p className="px-1 text-xs text-muted-foreground">
        As notificações deste aparelho serão desativadas. Você pode reativá-las
        em Notificações depois de entrar novamente.
      </p>
    </div>
  )
}
