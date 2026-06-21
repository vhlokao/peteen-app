"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ShellSessionUser } from "@/types";

const ROLE_LABEL: Record<NonNullable<ShellSessionUser["primaryRole"]>, string> = {
  TUTOR: "Tutor",
  PROFESSIONAL: "Profissional",
  PARTNER: "Parceiro",
  ADMIN: "Admin",
};

type TopBarProps = {
  showThemeToggle?: boolean;
  /** Usuário serializado vindo do AppShell (Server Component). Null em rotas de marketing. */
  user?: ShellSessionUser | null;
};

function getInitials(email: string): string {
  const [local] = email.split("@");
  return (local ?? "?").slice(0, 2).toUpperCase();
}

export function TopBar({ showThemeToggle = true, user }: TopBarProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isMarketing = pathname === "/";
  const isAuthenticated = !!user;

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--content-max-width)] items-center justify-between px-[var(--page-padding-x)]">
        {/* Logo — oculto no desktop autenticado (aparece na sidebar) */}
        <Link
          href={isAuthenticated ? "#" : "/"}
          aria-label="Peteen — página inicial"
          className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-foreground lg:hidden"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
            P
          </span>
          <span className="sr-only sm:not-sr-only">Peteen</span>
        </Link>

        {/* Espaçador desktop: logo fica na sidebar, header desktop fica vazio à esquerda */}
        <div className="hidden lg:block" />

        {/* Ações à direita */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Marketing: botões de auth */}
          {isMarketing && !isAuthenticated ? (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Entrar
              </Link>
              <Link href="/tutor" className={buttonVariants({ size: "sm" })}>
                Sou tutor
              </Link>
            </>
          ) : null}

          {/* Toggle de tema */}
          {showThemeToggle ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Alternar tema"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </Button>
          ) : null}

          {/* Avatar do usuário autenticado */}
          {isAuthenticated && user ? (
            <Link
              href={
                user.primaryRole === "PROFESSIONAL"
                  ? "/professional"
                  : user.primaryRole === "ADMIN"
                    ? "/admin"
                    : "/tutor/perfil"
              }
              className="flex items-center gap-2"
              aria-label="Ir para perfil"
            >
              {user.primaryRole ? (
                <Badge
                  variant="secondary"
                  className="hidden text-[0.65rem] uppercase tracking-wide sm:inline-flex"
                >
                  {ROLE_LABEL[user.primaryRole]}
                </Badge>
              ) : null}
              <Avatar size="sm">
                <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
              </Avatar>
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
