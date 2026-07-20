import Link from "next/link"
import { User, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const NAVY = "#1D2F6F"

const ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Meus serviços", href: "/professional/services", icon: Wrench },
  { label: "Meu perfil", href: "/professional/profile", icon: User },
]

/**
 * Atalhos da Home — reskin: reduzido aos dois destinos pedidos no design
 * (serviços e perfil). As demais rotas (solicitações, agenda, clientes,
 * avaliações, métricas) continuam acessíveis por outros pontos de
 * navegação, só não ficam mais atalhadas aqui.
 */
export function ProfessionalQuickActions() {
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
            <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `${NAVY}14`, color: NAVY }}>
              <Icon className="size-5" />
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
