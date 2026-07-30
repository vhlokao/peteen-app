"use client";

/**
 * BottomNav mobile — 3 ações de navegação da persona + "Conta".
 *
 * Itens de navegação vêm de appNavigation[variant].mobile (fonte única de
 * navegação). O 4º item, "Conta", não é um link — é o gatilho do mesmo menu
 * de conta usado no avatar do header (AccountMenuContent), aberto para cima
 * (side="top") já que o gatilho fica na borda inferior da tela.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCircle } from "lucide-react";
import { Menu } from "@base-ui/react/menu";

import {
  appNavigation,
  filterNavigationItems,
  isNavigationItemActive,
} from "@/lib/navigation/app-navigation";
import { AccountMenuContent } from "@/components/layout/account-menu-content";
import { useAccountMenuTrigger } from "@/components/layout/account-menu-scope";
import type { NavigationItem } from "@/lib/navigation/navigation-types";
import { cn } from "@/lib/utils";
import type { AppShellVariant, ShellSessionUser } from "@/types";

type BottomNavProps = {
  variant: AppShellVariant;
  user: ShellSessionUser;
};

const triggerClass =
  "touch-target flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[0.6875rem] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground data-[popup-open]:text-primary";

function NavLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const active = isNavigationItemActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "touch-target flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[0.6875rem] font-medium transition-colors",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className={cn("size-5", active && "stroke-[2.5]")} />
      {/* shortLabel para caber no espaço reduzido do mobile */}
      <span>{item.shortLabel ?? item.label}</span>
    </Link>
  );
}

function AccountTrigger({ variant, user }: { variant: AppShellVariant; user: ShellSessionUser }) {
  // Controlado pelo AccountMenuScope — abrir este gatilho fecha o avatar do
  // header automaticamente (e vice-versa). Ver account-menu-scope.tsx.
  const { open, onOpenChange } = useAccountMenuTrigger("bottom-nav-account");

  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger aria-label="Menu da conta" className={triggerClass}>
        <UserCircle className={cn("size-5", open && "stroke-[2.5]")} />
        <span>Conta</span>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          side="top"
          align="end"
          sideOffset={8}
          className="z-50 max-w-[calc(100vw-1.5rem)] outline-none"
        >
          <AccountMenuContent variant={variant} user={user} />
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// Gatilho "Conta" só existe para as personas com AppShell (tutor/profissional/
// parceiro). "admin" aqui é só o fallback do AppShell genérico — o backoffice
// de verdade usa AdminShell, sem BottomNav, sem conceito de "Conta".
const VARIANTS_WITH_ACCOUNT_TRIGGER: ReadonlySet<AppShellVariant> = new Set([
  "tutor",
  "professional",
  "partner",
]);

export function BottomNav({ variant, user }: BottomNavProps) {
  const pathname = usePathname();
  const items = filterNavigationItems(appNavigation[variant].mobile);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-[var(--bottom-nav-height)] max-w-lg items-stretch px-2">
        {items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        {VARIANTS_WITH_ACCOUNT_TRIGGER.has(variant) ? (
          <AccountTrigger variant={variant} user={user} />
        ) : null}
      </div>
    </nav>
  );
}
