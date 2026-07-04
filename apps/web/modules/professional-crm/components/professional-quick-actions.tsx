import Link from "next/link"
import { BarChart3, CalendarClock, Inbox, Star, Users, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const PRIMARY_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Solicitações", href: "/requests", icon: Inbox },
  { label: "Agenda", href: "/professional/agenda", icon: CalendarClock },
  { label: "Clientes", href: "/professional/clients", icon: Users },
  { label: "Serviços", href: "/professional/services", icon: Wrench },
]

const SECONDARY_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Avaliações", href: "/professional/reviews", icon: Star },
  { label: "Métricas", href: "/professional/metricas", icon: BarChart3 },
]

/**
 * Grid 2x2 de atalhos operacionais — visíveis sem abrir o AvatarMenu.
 * Rotas reais já existentes no projeto, nenhuma nova.
 */
export function ProfessionalQuickActions() {
  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Ações rápidas
      </p>
      <div className="grid grid-cols-2 gap-3">
        {PRIMARY_ACTIONS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 text-center shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SECONDARY_ACTIONS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/25 hover:text-primary"
          >
            <Icon className="size-3.5 shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </section>
  )
}
