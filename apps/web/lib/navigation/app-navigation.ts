/**
 * app-navigation — fonte única de verdade da navegação do Peteen.
 *
 * Arquitetura (UX 3.0.4 — header contextual minimalista):
 *  - Header desktop = navegação GERAL/contextual mínima, quase sem itens.
 *    Ver getProductHeaderNavigation. Nunca mostra "Sou tutor/profissional/
 *    parceiro" (o onboarding já resolve a persona) nem o painel do ator.
 *  - AvatarMenu = navegação OPERACIONAL do ator logado, agrupada em seções.
 *    Ver appNavigation[variant].actorSections.
 *  - BottomNav mobile = as 4 ações principais do ator.
 *    Ver appNavigation[variant].mobile.
 *
 * Princípio de produto: "o que essa pessoa veio fazer agora?" — o header não
 * mostra tudo que existe; o que é específico do ator fica no avatar.
 *
 * Regras:
 *  - Bottom nav mobile: exatamente 4 itens por persona.
 *  - Notificações ficam no sino do TopBar, nunca no bottom nav.
 *  - Conta/configurações/sair ficam no menu do avatar, nunca no header/bottom nav.
 *  - Nenhum item aponta para rota que não existe no app/ tree.
 *  - Nenhuma CTA concorrente no header ("Sou X" só existe na landing pública
 *    para visitante não autenticado, e como uma única CTA "Começar").
 *
 * Nota: o backoffice (admin) usa AdminShell/AdminNav próprios — a entrada "admin"
 * aqui existe apenas como fallback para o AppShell genérico.
 */

import {
  BarChart3,
  Calendar,
  Clock,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  MessageSquareWarning,
  Package,
  PawPrint,
  Search,
  ShieldCheck,
  Star,
  ThumbsUp,
  UserCircle,
  Users,
} from "lucide-react"

import type { AppShellVariant } from "@/types"
import type { ActorNavSection, NavigationItem, PersonaNavigation, ShellLayout } from "./navigation-types"

/**
 * Forma do shell desktop por persona.
 *
 * Nenhuma persona logada usa sidebar hoje — todas navegam pelo header
 * horizontal (top-nav) + AvatarMenu operacional. "rail" fica reservado
 * para o caso de uma persona voltar a precisar de navegação densa fora
 * do avatar.
 */
export const shellLayoutByVariant: Record<AppShellVariant, ShellLayout> = {
  marketing: "none",
  tutor: "top-nav",
  partner: "top-nav",
  professional: "top-nav",
  admin: "none",
}

const HOME_HREF_BY_VARIANT: Record<AppShellVariant, string> = {
  marketing: "/",
  tutor: "/tutor",
  professional: "/professional",
  partner: "/partner",
  admin: "/admin",
}

/** Home segura por persona — usada pelo item "Painel..." no AvatarMenu e pela troca de área. */
export function getHomeHrefForVariant(variant: AppShellVariant): string {
  return HOME_HREF_BY_VARIANT[variant]
}

const ROLE_TO_VARIANT: Record<string, Exclude<AppShellVariant, "marketing">> = {
  TUTOR: "tutor",
  PROFESSIONAL: "professional",
  PARTNER: "partner",
  ADMIN: "admin",
}

/**
 * Mapeia a role primária do usuário para a persona/variant correspondente.
 * Usado pelo TopBar para calcular a "persona efetiva" quando um usuário
 * autenticado acessa a landing pública (variant prop = "marketing", mas o
 * header deve mostrar a navegação do ator, não tratá-lo como visitante).
 */
export function getVariantForRole(role: string): Exclude<AppShellVariant, "marketing"> | null {
  return ROLE_TO_VARIANT[role] ?? null
}

/**
 * Navegação GERAL da Peteen no header desktop.
 *
 * O onboarding já resolve a persona do usuário — o header não precisa (e não
 * deve) duplicar isso com "Sou tutor/profissional/parceiro". O painel do ator
 * (Painel do tutor/profissional/parceiro) já vive no AvatarMenu, então
 * "Início" também não entra aqui: o logo já cobre a home pública.
 *
 * Header contextual mínimo por persona:
 *  - Tutor: Buscar (é a ação central do tutor — encontrar profissional).
 *  - Profissional e Parceiro: nenhum item — eles vieram operar (pedidos,
 *    clientes, agenda, recomendações), não buscar. Header fica só
 *    Logo + Sino + Avatar.
 *
 * "Como funciona", "Planos" e listagem de "Parceiros": omitidos — sem rota
 * nem anchor reais ainda. Melhor omitir do que linkar quebrado.
 */
export function getProductHeaderNavigation(variant: AppShellVariant): NavigationItem[] {
  if (variant === "tutor") {
    return [{ label: "Buscar", href: "/discover", icon: Search }]
  }
  return []
}

export const appNavigation: Record<AppShellVariant, PersonaNavigation> = {
  marketing: {
    actorSections: [],
    mobile: [],
  },

  tutor: {
    actorSections: [
      {
        title: "Minha área",
        items: [
          { label: "Painel do tutor", href: "/tutor", icon: LayoutDashboard, exact: true },
          { label: "Minhas solicitações", href: "/tutor/requests", icon: Inbox },
          { label: "Meus pets", href: "/me/pets", icon: PawPrint },
          { label: "Meu perfil", href: "/tutor/perfil", icon: UserCircle },
        ],
      },
    ],
    mobile: [
      { label: "Início", shortLabel: "Início", href: "/tutor", icon: LayoutDashboard, exact: true },
      { label: "Buscar", shortLabel: "Buscar", href: "/discover", icon: Search },
      { label: "Solicitações", shortLabel: "Pedidos", href: "/tutor/requests", icon: Inbox },
      { label: "Perfil", shortLabel: "Perfil", href: "/tutor/perfil", icon: UserCircle },
    ],
  },

  professional: {
    actorSections: [
      {
        title: "Minha área",
        items: [
          { label: "Painel profissional", href: "/professional", icon: LayoutDashboard, exact: true },
          { label: "Solicitações", href: "/requests", icon: Inbox },
          { label: "Clientes", href: "/professional/clients", icon: Users },
          { label: "Pets atendidos", href: "/professional/pets", icon: PawPrint },
          { label: "Agenda", href: "/professional/agenda", icon: Calendar },
          { label: "Serviços", href: "/professional/services", icon: Package },
          { label: "Avaliações", href: "/professional/reviews", icon: Star },
          { label: "Métricas", href: "/professional/metricas", icon: BarChart3 },
          { label: "Perfil público", href: "/professional/profile", icon: UserCircle },
        ],
      },
    ],
    mobile: [
      { label: "Início", shortLabel: "Início", href: "/professional", icon: LayoutDashboard, exact: true },
      { label: "Solicitações", shortLabel: "Pedidos", href: "/requests", icon: Inbox },
      { label: "Clientes", shortLabel: "Clientes", href: "/professional/clients", icon: Users },
      { label: "Perfil", shortLabel: "Perfil", href: "/professional/profile", icon: UserCircle },
    ],
  },

  partner: {
    actorSections: [
      {
        title: "Minha área",
        items: [
          { label: "Painel parceiro", href: "/partner", icon: LayoutDashboard, exact: true },
          { label: "Recomendar profissional", href: "/partner/recommendations", icon: ThumbsUp },
          { label: "Pendentes", href: "/partner/pending", icon: Clock },
          { label: "Métricas", href: "/partner/metrics", icon: BarChart3 },
          { label: "Perfil do parceiro", href: "/partner/profile", icon: UserCircle },
        ],
      },
    ],
    mobile: [
      { label: "Início", shortLabel: "Início", href: "/partner", icon: LayoutDashboard, exact: true },
      { label: "Recomendar", shortLabel: "Recomendar", href: "/partner/recommendations", icon: ThumbsUp },
      { label: "Pendentes", shortLabel: "Pendentes", href: "/partner/pending", icon: Clock },
      { label: "Perfil", shortLabel: "Perfil", href: "/partner/profile", icon: UserCircle },
    ],
  },

  // Fallback — o route group (admin) usa AdminShell/AdminNav próprios.
  admin: {
    actorSections: [
      {
        title: "Backoffice",
        items: [
          { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
          { label: "Usuários", href: "/admin/users", icon: Users },
          { label: "Profissionais", href: "/admin/professionals", icon: UserCircle },
          { label: "Parceiros", href: "/admin/partners", icon: ThumbsUp },
          { label: "Solicitações", href: "/admin/requests", icon: Inbox },
          { label: "Disputas", href: "/admin/disputes", icon: MessageSquareWarning },
          { label: "Atividades", href: "/admin/activity", icon: Clock },
          { label: "Dev Tools", href: "/admin/dev-tools", icon: FlaskConical, devOnly: true },
        ],
      },
    ],
    mobile: [
      { label: "Dashboard", shortLabel: "Painel", href: "/admin", icon: LayoutDashboard, exact: true },
      { label: "Usuários", shortLabel: "Usuários", href: "/admin/users", icon: Users },
      { label: "Solicitações", shortLabel: "Pedidos", href: "/admin/requests", icon: Inbox },
      { label: "Disputas", shortLabel: "Disputas", href: "/admin/disputes", icon: MessageSquareWarning },
    ],
  },
}

/**
 * Seção "Trocar área" do AvatarMenu — só existe quando o usuário de fato tem
 * mais de uma persona (user.roles.length > 1). Não valida nem cria permissão
 * nova: só lê o array `roles` já retornado pelo identity module.
 *
 * Labels neutras ("Ir para área do X") — não afirmamos acesso validado,
 * apenas navegação para uma rota que a persona já possui.
 */
const ROLE_SWITCH_ICON: Record<Exclude<AppShellVariant, "marketing">, typeof UserCircle> = {
  tutor: UserCircle,
  professional: Users,
  partner: ThumbsUp,
  admin: ShieldCheck,
}

const ROLE_SWITCH_LABEL: Record<Exclude<AppShellVariant, "marketing">, string> = {
  tutor: "Ir para área do tutor",
  professional: "Ir para área profissional",
  partner: "Ir para área do parceiro",
  admin: "Ir para o backoffice",
}

export function getAreaSwitchSection(roles: string[], currentVariant: AppShellVariant): ActorNavSection | null {
  if (roles.length <= 1) return null

  const items: NavigationItem[] = roles
    .map((role) => getVariantForRole(role))
    .filter((variant): variant is Exclude<AppShellVariant, "marketing"> => !!variant && variant !== currentVariant)
    .map((variant) => ({
      label: ROLE_SWITCH_LABEL[variant],
      href: getHomeHrefForVariant(variant),
      icon: ROLE_SWITCH_ICON[variant],
    }))

  if (items.length === 0) return null

  return { title: "Trocar área", items }
}

/**
 * Remove itens devOnly fora de development.
 * NODE_ENV é inlined no bundle client, então funciona em Client Components.
 */
export function filterNavigationItems(items: NavigationItem[]): NavigationItem[] {
  if (process.env.NODE_ENV === "development") return items
  return items.filter((item) => !item.devOnly)
}

/**
 * Active state por segmento de rota.
 *
 * `exact` ativa apenas em match exato (raízes de persona: /tutor, /professional…).
 * Caso contrário, ativa no próprio href e em qualquer subrota dele
 * (/discover ativa em /discover/abc, mas /tutor não "vaza" para /tutor/requests).
 */
export function isNavigationItemActive(pathname: string, item: NavigationItem): boolean {
  if (item.disabled || item.href === "#") return false
  const path = pathname.replace(/\/+$/, "") || "/"
  const base = item.href.replace(/\/+$/, "") || "/"
  if (item.exact) return path === base
  return path === base || path.startsWith(`${base}/`)
}
