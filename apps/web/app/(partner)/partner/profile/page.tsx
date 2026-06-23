import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { buildPartnerPublicUrl } from "@/modules/partner-portal/domain/navigation"
import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { toPartnerPortalProfile } from "@/modules/partner-portal/infrastructure/repository"
import { PartnerProfileEditForm } from "@/modules/partner-portal/components/partner-profile-edit-form"

export const metadata: Metadata = {
  title: "Perfil da organização — Parceiro",
}

export default async function PartnerProfilePage() {
  const { partner } = await requirePartnerContext()
  const profile = toPartnerPortalProfile(partner)

  return (
    <div className="page-container max-w-2xl space-y-6">
      <PageHeader
        title="Perfil da organização"
        description="Atualize as informações exibidas no perfil público da sua organização."
        action={
          <Link
            href={buildPartnerPublicUrl(partner.slug, "/partner/profile")}
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            Ver perfil público
            <ExternalLink className="size-3.5" />
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados da organização</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnerProfileEditForm partner={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
