import Link from "next/link"
import { RotateCcw, Sparkles } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"
import type { HiredProfessionalSummary } from "@/modules/tutor-portal/domain/types"

/**
 * Rede de confiança do tutor — profissionais já contratados (dado real,
 * já existente em findHiredProfessionalsByTutorId). "Cliente recorrente" é
 * derivado de totalServices >= 2, um sinal humano, nunca o trust score bruto.
 *
 * Sem dado real ainda: bloco educativo, sem inventar profissionais.
 */
export function TutorTrustNetworkCard({
  professionals,
}: {
  professionals: HiredProfessionalSummary[]
}) {
  if (professionals.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Sua rede de confiança começa aqui
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Quando você contrata, avalia e volta a chamar profissionais, a Peteen
              entende melhor em quem você confia.
            </p>
          </div>
        </div>
        <Link
          href="/discover"
          className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4 w-full" })}
        >
          Buscar profissionais
        </Link>
      </section>
    )
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">Sua rede de confiança</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {professionals.slice(0, 6).map((pro) => {
          const initials = pro.displayName
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase()

          return (
            <Link
              key={pro.professionalId}
              href={buildDiscoverUrl(pro.professionalId, { from: "tutor", returnTo: "/tutor" })}
              className="flex w-40 shrink-0 flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  {pro.avatarUrl && <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {pro.displayName}
                  </p>
                  <p className="truncate text-[0.65rem] text-muted-foreground">{pro.city}</p>
                </div>
              </div>
              {pro.totalServices >= 2 ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-medium text-primary">
                  <RotateCcw className="size-2.5" />
                  Cliente recorrente
                </span>
              ) : (
                <span className="truncate text-[0.65rem] text-muted-foreground">
                  {SERVICE_TYPE_LABELS[pro.lastServiceType]}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
