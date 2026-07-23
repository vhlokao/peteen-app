"use client"

/**
 * AvatarMenu — central operacional do ator logado.
 *
 * Arquitetura (UX 3.0.2): o header desktop mostra navegação GERAL da Peteen
 * (TopNavLinks). Tudo que é específico do ator — painel, solicitações,
 * pets, perfil, etc. — vive aqui, organizado em seções:
 *
 *  1. Identidade (e-mail + persona atual)
 *  2. Minha área — appNavigation[variant].actorSections
 *  3. Trocar área — só aparece se o usuário tiver mais de uma persona
 *     (lê user.roles, dado já existente; não cria permissão nova)
 *  4. Conta — Configurações/Segurança (placeholders até existir rota) + Sair
 */

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { LogOut, Settings, ShieldQuestion } from "lucide-react"
import { Menu } from "@base-ui/react/menu"

import {
  appNavigation,
  filterNavigationItems,
  getAreaSwitchSection,
  isNavigationItemActive,
} from "@/lib/navigation/app-navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { ActorNavSection } from "@/lib/navigation/navigation-types"
import type { AppShellVariant, ShellSessionUser } from "@/types"

const ROLE_LABEL: Record<NonNullable<ShellSessionUser["primaryRole"]>, string> = {
  TUTOR: "Tutor",
  PROFESSIONAL: "Profissional",
  PARTNER: "Parceiro",
  ADMIN: "Admin",
}

type AvatarMenuProps = {
  variant: AppShellVariant
  user: ShellSessionUser
}

function getInitials(email: string): string {
  const [local] = email.split("@")
  return (local ?? "?").slice(0, 2).toUpperCase()
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-muted"

const sectionTitleClass = "px-2.5 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70"

function MenuSection({ section, pathname }: { section: ActorNavSection; pathname: string }) {
  return (
    <div>
      <p className={sectionTitleClass}>{section.title}</p>
      {section.items.map((item) => {
        const Icon = item.icon
        if (item.disabled) {
          return (
            <Menu.Item key={item.label} disabled className={cn(itemClass, "cursor-default opacity-50")}>
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span>{item.label}</span>
              <span className="ml-auto text-[0.6rem] text-muted-foreground">em breve</span>
            </Menu.Item>
          )
        }
        const active = isNavigationItemActive(pathname, item)
        return (
          <Menu.LinkItem
            key={item.href}
            closeOnClick
            render={<Link href={item.href} />}
            className={cn(itemClass, active && "bg-primary/10 text-primary")}
          >
            <Icon className={cn("size-4 shrink-0", active ? "stroke-[2.5] text-primary" : "text-muted-foreground")} />
            <span>{item.label}</span>
          </Menu.LinkItem>
        )
      })}
    </div>
  )
}

export function AvatarMenu({ variant, user }: AvatarMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const actorSections = appNavigation[variant].actorSections.map((section) => ({
    ...section,
    items: filterNavigationItems(section.items),
  }))
  const areaSwitchSection = getAreaSwitchSection(user.roles, variant)

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Menu da conta"
        className="flex cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar size="sm">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.email} />}
          <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
        </Avatar>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50 max-w-[calc(100vw-1.5rem)] outline-none">
          <Menu.Popup className="w-[21rem] max-w-full overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
            {/* Identidade do usuário */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <Avatar size="sm" className="shrink-0">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.email} />}
                <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
                {user.primaryRole ? (
                  <span className="mt-0.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
                    {ROLE_LABEL[user.primaryRole]}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-1.5">
              {/* Minha área — navegação operacional do ator */}
              {actorSections.map((section) => (
                <MenuSection key={section.title} section={section} pathname={pathname} />
              ))}

              {/* Trocar área — só se o usuário tiver mais de uma persona real */}
              {areaSwitchSection ? (
                <>
                  <div role="separator" className="mx-1.5 my-1 border-t border-border" />
                  <MenuSection section={areaSwitchSection} pathname={pathname} />
                </>
              ) : null}

              {/* Conta */}
              <div role="separator" className="mx-1.5 my-1 border-t border-border" />
              <div>
                <p className={sectionTitleClass}>Conta</p>
                <Menu.Item disabled className={cn(itemClass, "cursor-default opacity-50")}>
                  <Settings className="size-4 shrink-0 text-muted-foreground" />
                  <span>Configurações</span>
                  <span className="ml-auto text-[0.6rem] text-muted-foreground">em breve</span>
                </Menu.Item>
                <Menu.Item disabled className={cn(itemClass, "cursor-default opacity-50")}>
                  <ShieldQuestion className="size-4 shrink-0 text-muted-foreground" />
                  <span>Segurança</span>
                  <span className="ml-auto text-[0.6rem] text-muted-foreground">em breve</span>
                </Menu.Item>
                <Menu.Item
                  onClick={handleSignOut}
                  className={cn(itemClass, "text-muted-foreground data-[highlighted]:text-destructive")}
                >
                  <LogOut className="size-4 shrink-0" />
                  <span>Sair</span>
                </Menu.Item>
              </div>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
