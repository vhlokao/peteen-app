"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Briefcase,
  ClipboardList,
  Star,
  TrendingUp,
  Repeat2,
  Flag,
  MessageSquareWarning,
  ScrollText,
  ShieldAlert,
  Award,
  Sparkles,
  Network,
  MapPin,
  Handshake,
  ClipboardCheck,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavGroup = {
  title: string
  items: Array<{ href: string; label: string; icon: React.ElementType; exact: boolean }>
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Plataforma",
    items: [
      { href: "/admin",               label: "Visão geral",     icon: LayoutDashboard,  exact: true  },
      { href: "/admin/users",         label: "Usuários",         icon: Users,            exact: false },
      { href: "/admin/tutors",        label: "Tutores",          icon: ShieldCheck,      exact: false },
      { href: "/admin/professionals", label: "Profissionais",    icon: Briefcase,        exact: false },
      { href: "/admin/requests",      label: "Solicitações",     icon: ClipboardList,    exact: false },
      { href: "/admin/reviews",       label: "Reviews",          icon: Star,             exact: false },
    ],
  },
  {
    title: "Trust & Recorrência",
    items: [
      { href: "/admin/trust",         label: "Trust Engine",     icon: TrendingUp,       exact: false },
      { href: "/admin/relationships", label: "Relacionamentos",  icon: Repeat2,          exact: false },
    ],
  },
  {
    title: "Expansão",
    items: [
      { href: "/admin/growth", label: "Growth Engine", icon: MapPin, exact: true },
    ],
  },
  {
    title: "Confiança",
    items: [
      { href: "/admin/verifications", label: "Fila de Verificações", icon: ClipboardCheck, exact: false },
      { href: "/admin/badges",           label: "Status dos Profissionais", icon: Award,          exact: false },
      { href: "/admin/partners",         label: "Parceiros",             icon: Handshake, exact: false },
      { href: "/admin/recommendations",  label: "Recomendações",         icon: Sparkles,  exact: false },
      { href: "/admin/trust-graph",      label: "Trust Graph",           icon: Network,   exact: true  },
    ],
  },
  {
    title: "Segurança",
    items: [
      { href: "/admin/flags",    label: "Flags",        icon: Flag,                 exact: false },
      { href: "/admin/disputes", label: "Disputas",     icon: MessageSquareWarning, exact: false },
      { href: "/admin/activity", label: "Atividades",   icon: Activity,             exact: false },
      { href: "/admin/audit",    label: "Auditoria",    icon: ScrollText,           exact: false },
      { href: "/admin/risk",     label: "Risk Score",   icon: ShieldAlert,          exact: false },
    ],
  },
]

function normalizePath(pathname: string): string {
  if (!pathname) return "/"
  const trimmed = pathname.replace(/\/+$/, "")
  return trimmed || "/"
}

/**
 * Match por segmento — evita colisão entre /admin/trust e /admin/trust-graph.
 * Causa raiz histórica: pathname.startsWith("/admin/trust") também ativa trust-graph.
 */
function isNavActive(pathname: string, href: string, exact: boolean): boolean {
  const path = normalizePath(pathname)
  const base = normalizePath(href)

  if (base === "/admin/trust") {
    if (path === "/admin/trust-graph" || path.startsWith("/admin/trust-graph/")) {
      return false
    }
    if (path === "/admin/trust") return true
    if (path.startsWith("/admin/trust-debug/")) return true
    if (path === "/admin/trust-recalculate") return true
    return false
  }

  if (base === "/admin/trust-graph") {
    return path === "/admin/trust-graph" || path.startsWith("/admin/trust-graph/")
  }

  if (exact) return path === base

  return path === base || path.startsWith(`${base}/`)
}

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-4 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon, exact }) => {
              const isActive = isNavActive(pathname, href, exact)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
