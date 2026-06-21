import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { ProfessionalProfileEditForm } from "@/modules/professional/components/professional-profile-edit-form"
import { ProfessionalTrustSummary } from "@/modules/reputation-badges/components/professional-trust-summary"

export const metadata: Metadata = {
  title: "Meu perfil profissional",
}

export default async function ProfessionalProfilePage() {
  const { profile } = await requireProfessionalContext()

  return (
    <div className="page-container max-w-2xl space-y-6">
      <PageHeader
        title="Meu perfil profissional"
        description="Atualize as informações que aparecem para tutores no Discovery."
        action={
          <Link
            href={`/discover/${profile.id}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
            target="_blank"
          >
            Ver perfil público
            <ExternalLink className="size-3.5" />
          </Link>
        }
      />

      <ProfessionalTrustSummary professionalId={profile.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do profissional</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfessionalProfileEditForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
