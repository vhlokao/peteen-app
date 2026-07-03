"use client";

/**
 * BottomNav mobile — exatamente as 4 ações principais da persona.
 *
 * Itens vêm de appNavigation[variant].mobile (fonte única de navegação).
 * Notificações ficam no sino do TopBar. Conta/configurações/sair ficam
 * no AvatarMenu. Nada disso entra aqui.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  appNavigation,
  filterNavigationItems,
  isNavigationItemActive,
} from "@/lib/navigation/app-navigation";
import type { NavigationItem } from "@/lib/navigation/navigation-types";
import { cn } from "@/lib/utils";
import type { AppShellVariant } from "@/types";

type BottomNavProps = {
  variant: AppShellVariant;
};

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

export function BottomNav({ variant }: BottomNavProps) {
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
      </div>
    </nav>
  );
}
