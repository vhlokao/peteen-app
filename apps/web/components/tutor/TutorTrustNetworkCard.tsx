import Link from "next/link"
import { Heart, Sparkles } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"
import type { HiredProfessionalSummary } from "@/modules/tutor-portal/domain/types"

const NAVY = "#1D2F6F"
const GREEN = "#40916C"
const CORAL = "#E07A5F"

/**
 * Rede de confiança do tutor — profissionais já contratados (dado real,
 * já existente em findHiredProfessionalsByTutorId). "Cliente recorrente" é
 * derivado de totalServices >= 2, um sinal humano, nunca o trust score bruto.
 * Sem selo de "verificado" aqui — HiredProfessionalSummary não carrega esse
 * campo e checá-lo exigiria uma query nova por profissional.
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
    <div className="overflow-hidden rounded-[18px] border border-border bg-card p-1.5">
      {professionals.slice(0, 6).map((pro) => {
        const initials = pro.displayName
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase()

        const recurring = pro.totalServices >= 2

        return (
          <Link
            key={pro.professionalId}
            href={buildDiscoverUrl(pro.professionalId, { from: "tutor", returnTo: "/tutor" })}
            className="flex w-full items-center gap-3 rounded-[14px] p-3 text-left transition-colors hover:bg-muted/50"
          >
            <Avatar
              className="size-[42px] shrink-0"
              style={{ background: "#E8EEF6" }}
            >
              {pro.avatarUrl && <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />}
              <AvatarFallback className="bg-transparent text-[13px] font-bold" style={{ color: NAVY }}>
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-foreground">{pro.displayName}</p>
              {recurring ? (
                <p className="truncate text-[12px] font-semibold" style={{ color: GREEN }}>
                  Você já contratou {pro.totalServices}×
                </p>
              ) : (
                <p className="truncate text-[12px] text-muted-foreground">
                  {SERVICE_TYPE_LABELS[pro.lastServiceType]}
                </p>
              )}
            </div>

            {recurring && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-[5px] text-[11px] font-bold"
                style={{ background: "#FBEDE8", color: CORAL }}
              >
                <Heart className="size-3" fill="currentColor" />
                Recorrente
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
