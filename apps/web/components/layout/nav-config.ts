import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PawPrint,
  Search,
  Shield,
  Users,
  BarChart3,
  Flag,
  Inbox,
  Star,
} from "lucide-react";

import type { AppShellVariant } from "@/types";

export type ShellNavItem = {
  /** Rótulo completo — usado na sidebar desktop expandida */
  label: string;
  /** Rótulo curto — usado no bottom nav mobile (máximo ~8 caracteres) */
  shortLabel: string;
  href: string;
  icon: LucideIcon;
};

export const shellNavConfig: Record<AppShellVariant, ShellNavItem[]> = {
  marketing: [],
  tutor: [
    { label: "Início", shortLabel: "Início", href: "/tutor", icon: LayoutDashboard },
    { label: "Descobrir", shortLabel: "Descobrir", href: "/discover", icon: Search },
    { label: "Solicitações", shortLabel: "Pedidos", href: "/tutor/requests", icon: Inbox },
    { label: "Pets", shortLabel: "Pets", href: "/me/pets", icon: PawPrint },
    { label: "Perfil", shortLabel: "Perfil", href: "/tutor/perfil", icon: Users },
  ],
  professional: [
    { label: "Início", shortLabel: "Início", href: "/professional", icon: LayoutDashboard },
    { label: "Solicitações", shortLabel: "Fila", href: "/requests", icon: Inbox },
    { label: "Clientes", shortLabel: "Clientes", href: "/professional/clients", icon: Users },
    { label: "Pets", shortLabel: "Pets", href: "/professional/pets", icon: PawPrint },
    { label: "Reviews", shortLabel: "Reviews", href: "/professional/reviews", icon: Star },
    { label: "Métricas", shortLabel: "Métricas", href: "/professional/metricas", icon: BarChart3 },
  ],
  admin: [
    { label: "Painel", shortLabel: "Painel", href: "/admin", icon: LayoutDashboard },
    { label: "Moderação", shortLabel: "Moderação", href: "/admin/moderacao", icon: Flag },
    { label: "Antifraude", shortLabel: "Fraude", href: "/admin/antifraude", icon: Shield },
    { label: "Rede", shortLabel: "Rede", href: "/admin/rede", icon: Users },
  ],
};
