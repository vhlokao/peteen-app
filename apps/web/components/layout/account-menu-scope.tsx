"use client"

/**
 * AccountMenuScope — garante exclusividade entre os dois gatilhos do menu de
 * conta (avatar do header e "Conta" do BottomNav mobile).
 *
 * Estado local simples (useState + Context), não é store global da app — vive
 * só dentro do AppShell, que já envolve TopBar + BottomNav na mesma árvore.
 * Nenhum querySelector, nenhum listener global: cada gatilho vira um
 * Menu.Root CONTROLADO (open/onOpenChange), então abrir um só precisa avisar
 * "agora sou eu" — o outro fecha porque seu próprio `open` prop passa a ser
 * `false` no próximo render, exatamente como o base-ui já suporta.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type AccountMenuTriggerId = "header-avatar" | "bottom-nav-account"

type AccountMenuScopeValue = {
  /** Qual gatilho está com o menu aberto agora, ou null se nenhum. */
  openTrigger: AccountMenuTriggerId | null
  /** Cada gatilho chama isto no seu onOpenChange. */
  setOpen: (id: AccountMenuTriggerId, open: boolean) => void
}

const AccountMenuScopeContext = createContext<AccountMenuScopeValue | null>(null)

export function AccountMenuScopeProvider({ children }: { children: ReactNode }) {
  const [openTrigger, setOpenTrigger] = useState<AccountMenuTriggerId | null>(null)

  const setOpen = useCallback((id: AccountMenuTriggerId, open: boolean) => {
    setOpenTrigger((current) => {
      if (open) return id
      // Só fecha se quem está pedindo pra fechar é quem está aberto — evita
      // que o gatilho que acabou de perder o foco "feche" o que acabou de abrir.
      return current === id ? null : current
    })
  }, [])

  return (
    <AccountMenuScopeContext.Provider value={{ openTrigger, setOpen }}>
      {children}
    </AccountMenuScopeContext.Provider>
  )
}

/**
 * Hook de conveniência para um gatilho específico: retorna se ESTE gatilho
 * está aberto e um onOpenChange pronto para o Menu.Root controlado.
 * Fora de um AccountMenuScopeProvider, funciona como estado local isolado
 * (fallback seguro — nunca quebra se o provider não existir).
 */
export function useAccountMenuTrigger(id: AccountMenuTriggerId) {
  const scope = useContext(AccountMenuScopeContext)
  const [fallbackOpen, setFallbackOpen] = useState(false)

  if (!scope) {
    return { open: fallbackOpen, onOpenChange: setFallbackOpen }
  }

  return {
    open: scope.openTrigger === id,
    onOpenChange: (open: boolean) => scope.setOpen(id, open),
  }
}
