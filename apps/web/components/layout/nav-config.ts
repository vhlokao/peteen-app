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
  UserCircle,
  ThumbsUp,
  Activity,
  Package,
  Bell,
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
    { label: "Atividades", shortLabel: "Ativid.", href: "/tutor/activity", icon: Activity },
    { label: "Notificações", shortLabel: "Alertas", href: "/tutor/notifications", icon: Bell },
  ],
  partner: [
    { label: "Início", shortLabel: "Início", href: "/partner", icon: LayoutDashboard },
    { label: "Recomendações", shortLabel: "Indicações", href: "/partner/recommendations", icon: ThumbsUp },
    { label: "Métricas", shortLabel: "Métricas", href: "/partner/metrics", icon: BarChart3 },
    { label: "Perfil", shortLabel: "Perfil", href: "/partner/profile", icon: UserCircle },
    { label: "Atividades", shortLabel: "Ativid.", href: "/partner/activity", icon: Activity },
    { label: "Notificações", shortLabel: "Alertas", href: "/partner/notifications", icon: Bell },
  ],
  professional: [
    { label: "Início", shortLabel: "Início", href: "/professional", icon: LayoutDashboard },
    { label: "Solicitações", shortLabel: "Fila", href: "/requests", icon: Inbox },
    { label: "Clientes", shortLabel: "Clientes", href: "/professional/clients", icon: Users },
    { label: "Pets", shortLabel: "Pets", href: "/professional/pets", icon: PawPrint },
    { label: "Avaliações", shortLabel: "Avaliaç.", href: "/professional/reviews", icon: Star },
    { label: "Serviços", shortLabel: "Serviços", href: "/professional/services", icon: Package },
    { label: "Métricas", shortLabel: "Métricas", href: "/professional/metricas", icon: BarChart3 },
    { label: "Perfil", shortLabel: "Perfil", href: "/professional/profile", icon: UserCircle },
    { label: "Atividades", shortLabel: "Ativid.", href: "/professional/activity", icon: Activity },
    { label: "Notificações", shortLabel: "Alertas", href: "/professional/notifications", icon: Bell },
  ],
  admin: [
    { label: "Painel", shortLabel: "Painel", href: "/admin", icon: LayoutDashboard },
    { label: "Usuários", shortLabel: "Usuários", href: "/admin/users", icon: Users },
    { label: "Auditoria", shortLabel: "Auditoria", href: "/admin/audit", icon: Activity },
    { label: "Confiança", shortLabel: "Confiança", href: "/admin/trust", icon: Shield },
    { label: "Moderação", shortLabel: "Moderação", href: "/admin/moderacao", icon: Flag },
  ],
};
