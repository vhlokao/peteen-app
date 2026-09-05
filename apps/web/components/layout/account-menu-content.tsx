"use client"

/**
 * AccountMenuContent — conteúdo compartilhado do menu de conta.
 *
 * Extraído de AvatarMenu para ser reutilizado por dois gatilhos diferentes:
 *   1. Avatar no header (AvatarMenu) — desktop e mobile.
 *   2. Item "Conta" no BottomNav mobile (BottomNavAccountTrigger).
 *
 * Mesma fonte de dados, mesmas seções, mesmo comportamento — só o gatilho
 * visual e o posicionamento do popup mudam entre os dois usos.
 */

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { LogOut, Settings } from "lucide-react"
import { Menu } from "@base-ui/react/menu"

import {
  appNavigation,
  filterNavigationItems,
  getAreaSwitchSection,
  isNavigationItemActive,
} from "@/lib/navigation/app-navigation"
import { executarLogout } from "@/lib/push/sign-out"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  accountHref,
  buildAccountHrefComRetorno,
  type AccountPersona,
} from "@/modules/identity/domain/account-navigation"
import { cn } from "@/lib/utils"
import type { ActorNavSection } from "@/lib/navigation/navigation-types"
import type { AppShellVariant, ShellSessionUser } from "@/types"

const ROLE_LABEL: Record<NonNullable<ShellSessionUser["primaryRole"]>, string> = {
  TUTOR: "Tutor",
  PROFESSIONAL: "Profissional",
  PARTNER: "Parceiro",
  ADMIN: "Admin",
}

export function getInitials(email: string): string {
  const [local] = email.split("@")
  return (local ?? "?").slice(0, 2).toUpperCase()
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-muted"

const sectionTitleClass = "px-2.5 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70"

/**
 * Personas que têm tela real de Conta/Configurações — só tutor e profissional
 * nesta V0 (UX R1). Parceiro/admin continuam sem: o item some do menu em vez
 * de apontar para uma rota que não existe.
 *
 * GATE-11: a rota em si passou a ser construída por
 * `buildAccountHrefComRetorno`, que carimba de ONDE o menu foi aberto. Conta é
 * uma tela empurrada alcançável de qualquer lugar, e sem esse carimbo o botão
 * Voltar dela não teria como saber para onde levar — cairia sempre na home,
 * mesmo quem veio de uma solicitação aberta.
 */
const ACCOUNT_PERSONA_BY_VARIANT: Partial<Record<AppShellVariant, AccountPersona>> = {
  tutor: "tutor",
  professional: "professional",
}

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

type AccountMenuContentProps = {
  variant: AppShellVariant
  user: ShellSessionUser
}

/** Conteúdo do popup — identidade + minha área + trocar área + conta. */
export function AccountMenuContent({ variant, user }: AccountMenuContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const actorSections = appNavigation[variant].actorSections.map((section) => ({
    ...section,
    items: filterNavigationItems(section.items),
  }))
  const areaSwitchSection = getAreaSwitchSection(user.roles, variant)
  const accountPersona = ACCOUNT_PERSONA_BY_VARIANT[variant]
  const contaHref = accountPersona
    ? buildAccountHrefComRetorno(accountPersona, pathname)
    : undefined

  async function handleSignOut() {
    // Sequência canônica única (revogar push → unsubscribe → signOut local).
    // A ordem é obrigatória por razão de segurança e vive num lugar só —
    // ver lib/push/sign-out.ts.
    await executarLogout()
    router.push("/login")
    router.refresh()
  }

  return (
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

      <div className="max-h-[70dvh] overflow-y-auto p-1.5">
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
          {contaHref && accountPersona ? (
            <Menu.LinkItem
              closeOnClick
              render={<Link href={contaHref} />}
              /* O estado ativo compara com a rota NUA (`accountHref`), não com
                 `contaHref` — este agora carrega `?returnTo=…`, e a query faria
                 a comparação de caminho falhar sempre. */
              className={cn(
                itemClass,
                isNavigationItemActive(pathname, {
                  label: "Conta",
                  href: accountHref(accountPersona),
                  icon: Settings,
                }) && "bg-primary/10 text-primary"
              )}
            >
              <Settings className="size-4 shrink-0 text-muted-foreground" />
              <span>Configurações</span>
            </Menu.LinkItem>
          ) : null}
          {/* Sair também fica aqui, além de ser a ação canônica em Conta/
              Configurações — por conveniência deliberada (UX R1): este popup
              JÁ é o hub de conta acessado em 1 toque (avatar ou botão "Conta"
              do BottomNav), então exigir uma navegação extra até /conta só
              para encerrar sessão adicionaria fricção sem ganho real. A
              duplicação que a auditoria sinalizou era outra: Sair solto
              dentro da página de Perfil (identidade), sem relação com Conta —
              essa foi removida (ver ProfessionalProfileSignOutButton). */}
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
  )
}
