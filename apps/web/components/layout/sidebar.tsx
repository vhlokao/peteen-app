"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { shellNavConfig, type ShellNavItem } from "@/components/layout/nav-config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { cn } from "@/lib/utils";
import type { AppShellVariant, ShellSessionUser } from "@/types";

const ROLE_LABEL: Record<NonNullable<ShellSessionUser["primaryRole"]>, string> = {
  TUTOR: "Tutor",
  PROFESSIONAL: "Profissional",
  PARTNER: "Parceiro",
  ADMIN: "Administrador",
};

type SidebarProps = {
  variant: AppShellVariant;
  /** Usuário serializado — passado pelo AppShell Server Component */
  user?: ShellSessionUser | null;
};

function isNavItemActive(pathname: string, href: string): boolean {
  const rootPaths = ["/tutor", "/professional", "/partner", "/admin"];
  if (rootPaths.includes(href)) {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

function SidebarLink({
  item,
  pathname,
  collapsed,
}: {
  item: ShellNavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isNavItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "stroke-[2.5]")} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function getInitials(email: string): string {
  const [local] = email.split("@");
  return (local ?? "?").slice(0, 2).toUpperCase();
}

export function Sidebar({ variant, user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const items = shellNavConfig[variant];

  if (items.length === 0) return null;

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "group/sidebar hidden shrink-0 border-r border-border/80 bg-sidebar transition-[width] duration-200 ease-in-out lg:flex lg:flex-col",
        collapsed ? "w-[var(--sidebar-collapsed-width,4rem)]" : "w-[var(--sidebar-width,15rem)]"
      )}
    >
      {/* Logo desktop — visível apenas na sidebar, não no header */}
      <div
        className={cn(
          "flex h-[var(--header-height)] shrink-0 items-center border-b border-border/80 px-4",
          collapsed && "justify-center px-0"
        )}
      >
        <Link
          href="/"
          aria-label="Peteen"
          className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-foreground"
        >
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">
            P
          </span>
          {!collapsed && <span>Peteen</span>}
        </Link>
      </div>

      {/* Itens de navegação */}
      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto p-2", collapsed && "px-2")}>
        {items.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Seção inferior: usuário + sign out */}
      {user ? (
        <div className="mt-auto space-y-1 border-t border-border/80 p-2">
          {/* Card do usuário */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? `${user.email} · ${user.primaryRole ? ROLE_LABEL[user.primaryRole] : ""}` : undefined}
          >
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {user.email}
                </p>
                {user.primaryRole ? (
                  <p className="text-[0.65rem] text-muted-foreground">
                    {ROLE_LABEL[user.primaryRole]}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/*
           * Slot para futuro PersonaSwitcher:
           * Quando um usuário tiver múltiplas personas (TUTOR + PROFESSIONAL),
           * este é o local para renderizar o dropdown de troca de persona.
           * Condição: user.roles.length > 1
           */}

          <Separator className="my-1" />

          <SignOutButton collapsed={collapsed} />
        </div>
      ) : null}

      {/* Botão de collapse — na base, separado do user section */}
      <div className={cn("border-t border-border/80 p-2", user && "border-t-0 pt-0")}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="w-full"
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </Button>
      </div>
    </aside>
  );
}
