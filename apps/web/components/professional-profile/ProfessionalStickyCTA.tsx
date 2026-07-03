import type { PetData } from "@/modules/tutor/domain/types"
import type { ProfessionalPublicProfile } from "@/modules/professional/domain/types"
import { RequestServiceSheet } from "@/modules/service-request/components/RequestServiceSheet"

type ProfessionalStickyCTAProps = {
  professional: Pick<ProfessionalPublicProfile, "id" | "displayName" | "services">
  pets: PetData[]
}

/**
 * CTA fixo mobile — barra acima do BottomNav (bottom: var(--bottom-nav-height),
 * nunca sobreposta a ele). RequestServiceSheet é reutilizado sem alteração —
 * mesma lógica de submissão, mesma rota real de destino.
 */
export function ProfessionalStickyCTA({ professional, pets }: ProfessionalStickyCTAProps) {
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-30 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-md lg:hidden">
      <RequestServiceSheet professional={professional} pets={pets} />
    </div>
  )
}
