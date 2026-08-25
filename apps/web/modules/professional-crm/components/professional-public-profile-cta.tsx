import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"

/**
 * Presença pública no dashboard — ver o próprio perfil como um tutor o vê.
 *
 * O botão de COMPARTILHAR saiu daqui e subiu para as Ações rápidas
 * (ver professional-quick-actions.tsx): estava a 706px do topo em 320px, fundo
 * demais para uma ação de aquisição. Este bloco ficou com o que de fato é
 * consulta de fim de página — conferir como o perfil aparece publicamente.
 *
 * Deliberadamente NÃO restou um segundo "compartilhar" aqui: dois CTAs para a
 * mesma ação na mesma tela dividem a atenção e fazem a pessoa hesitar sobre se
 * são coisas diferentes.
 */
export function ProfessionalPublicProfileCTA({
  professionalId,
}: {
  professionalId: string
}) {
  return (
    <Link
      href={buildDiscoverUrl(professionalId, { from: "professional", returnTo: "/professional" })}
      target="_blank"
      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-primary/25"
    >
      <span className="text-sm font-medium text-foreground">Ver meu perfil público</span>
      <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
