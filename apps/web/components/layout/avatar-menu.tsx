"use client"

/**
 * AvatarMenu — gatilho do menu de conta no header (avatar).
 *
 * Conteúdo do popup vive em AccountMenuContent (compartilhado com o gatilho
 * "Conta" do BottomNav mobile — ver bottom-nav.tsx). Este arquivo só cuida do
 * gatilho visual (avatar) e do posicionamento do popup ancorado no header.
 */

import { Menu } from "@base-ui/react/menu"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AccountMenuContent, getInitials } from "@/components/layout/account-menu-content"
import { useAccountMenuTrigger } from "@/components/layout/account-menu-scope"
import type { AppShellVariant, ShellSessionUser } from "@/types"

type AvatarMenuProps = {
  variant: AppShellVariant
  user: ShellSessionUser
}

export function AvatarMenu({ variant, user }: AvatarMenuProps) {
  // Controlado pelo AccountMenuScope — abrir este gatilho fecha o "Conta" do
  // BottomNav automaticamente (e vice-versa). Ver account-menu-scope.tsx.
  const { open, onOpenChange } = useAccountMenuTrigger("header-avatar")

  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger
        aria-label="Menu da conta"
        className="flex size-11 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar size="sm">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.email} />}
          <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
        </Avatar>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50 max-w-[calc(100vw-1.5rem)] outline-none">
          <AccountMenuContent variant={variant} user={user} />
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
