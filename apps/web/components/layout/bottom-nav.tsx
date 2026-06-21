"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { shellNavConfig, type ShellNavItem } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import type { AppShellVariant } from "@/types";

type BottomNavProps = {
  variant: AppShellVariant;
};

function isActive(pathname: string, href: string) {
  if (href === "/tutor" || href === "/professional" || href === "/admin") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

function NavLink({ item, pathname }: { item: ShellNavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
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
      <span>{item.shortLabel}</span>
    </Link>
  );
}

export function BottomNav({ variant }: BottomNavProps) {
  const pathname = usePathname();
  const items = shellNavConfig[variant];

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
