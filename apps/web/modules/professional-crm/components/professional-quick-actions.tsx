import Link from "next/link"
import { User, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cardInteractiveClasses } from "@/components/ui/card"
import { ShareProfileAction } from "@/modules/invite/components/share-profile-action"

const NAVY = "#1D2F6F"

const ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Meus serviços", href: "/professional/services", icon: Wrench },
  { label: "Meu perfil", href: "/professional/profile", icon: User },
]

/**
 * Atalhos da Home — serviços, perfil e compartilhar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE COMPARTILHAR ENTROU AQUI
 *
 * Antes ele vivia no fim da página, dentro do bloco de presença pública.
 * Medido em QA físico a 320px: o botão começava a 706px do topo — abaixo de
 * duas dobras, depois de métricas e atividade recente. Compartilhar o perfil
 * é uma ação de AQUISIÇÃO, recorrente e de baixo atrito; enterrá-la no rodapé
 * a tratava como conteúdo de referência, que é o oposto do que ela é.
 *
 * Continua existindo em UM outro lugar — a página de perfil — e em nenhum
 * mais. Os dois pontos são onde o profissional já está pensando na própria
 * presença. Não há duplicata dentro da Home: o bloco do rodapé ficou apenas
 * com "Ver meu perfil público".
 */
export function ProfessionalQuickActions({
  professionalId,
  professionalName,
}: {
  professionalId: string
  professionalName: string
}) {
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
            className={`flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 text-center shadow-[var(--shadow-card)] ${cardInteractiveClasses}`}
          >
            <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `${NAVY}14`, color: NAVY }}>
              <Icon className="size-5" />
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </Link>
        ))}
        <ShareProfileAction
          professionalId={professionalId}
          professionalName={professionalName}
        />
      </div>
    </section>
  )
}
