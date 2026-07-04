import Link from "next/link"
import { BarChart3, ThumbsUp, User, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Recomendar", href: "/partner/recommendations", icon: ThumbsUp },
  { label: "Pendências", href: "/partner/pending", icon: Users },
  { label: "Métricas", href: "/partner/metrics", icon: BarChart3 },
  { label: "Perfil", href: "/partner/profile", icon: User },
]

/**
 * Grid 2x2 de atalhos — visíveis sem abrir o AvatarMenu.
 */
export function PartnerQuickActions() {
  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Ações rápidas
      </p>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(({ label, href, icon: Icon }) => (
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
    </section>
  )
}
