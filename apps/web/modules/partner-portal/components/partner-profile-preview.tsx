import Link from "next/link"
import { ExternalLink, MapPin, ShieldCheck } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PARTNER_CATEGORY_LABELS, PARTNER_VERIFICATION_STATUS_LABELS } from "@/modules/partners/domain/constants"
import { buildPartnerPublicUrl } from "../domain/navigation"
import { PARTNER_VERIFICATION_TONE, VERIFICATION_TONE_CLASS } from "../domain/status-display"
import type { PartnerPortalProfile } from "../domain/types"

export function PartnerProfilePreview({ partner }: { partner: PartnerPortalProfile }) {
  const initials = partner.businessName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const tone = PARTNER_VERIFICATION_TONE[partner.verificationStatus]

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <Avatar className="size-14 shrink-0 rounded-xl">
          {partner.logoUrl && <AvatarImage src={partner.logoUrl} alt={partner.businessName} />}
          <AvatarFallback className="rounded-xl bg-primary/10 text-base font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{partner.businessName}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{partner.city}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary">
          {PARTNER_CATEGORY_LABELS[partner.category]}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${VERIFICATION_TONE_CLASS[tone]}`}
        >
          {tone === "success" && <ShieldCheck className="size-3" />}
          {PARTNER_VERIFICATION_STATUS_LABELS[partner.verificationStatus]}
        </span>
      </div>

      {partner.description && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{partner.description}</p>
      )}

      <Link
        href={buildPartnerPublicUrl(partner.slug, "/partner/profile")}
        target="_blank"
        className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border/70 px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/25"
      >
        Ver perfil público
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
      </Link>
    </section>
  )
}
