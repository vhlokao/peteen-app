"use client";

/**
 * TopNavLinks — navegação GERAL da Peteen no header desktop.
 *
 * Não é a navegação operacional do ator (isso vive no AvatarMenu). Lê
 * getProductHeaderNavigation(variant) — mesma função para toda persona logada.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getProductHeaderNavigation,
  isNavigationItemActive,
} from "@/lib/navigation/app-navigation";
import { cn } from "@/lib/utils";
import type { AppShellVariant } from "@/types";

type TopNavLinksProps = {
  variant: AppShellVariant;
};

export function TopNavLinks({ variant }: TopNavLinksProps) {
  const pathname = usePathname();
  const items = getProductHeaderNavigation(variant);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
      {items.map((item) => {
        const active = isNavigationItemActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className={cn("size-4 shrink-0", active && "stroke-[2.5]")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
