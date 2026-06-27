import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireAuth } from "@/modules/identity/application/get-session"
import { redirect } from "next/navigation"
import { findPartnerProfileByUserId } from "@/modules/partner-portal/infrastructure/repository"

export const metadata: Metadata = {
  title: "Vínculo pendente — Parceiro",
}

export default async function PartnerPendingPage() {
  const session = await requireAuth()

  if (!session.roles.includes("PARTNER")) {
    redirect("/dashboard")
  }

  const profile = await findPartnerProfileByUserId(session.id)
  if (!profile) {
    redirect("/onboarding/partner")
  }

  if (profile.linkedPartnerId) {
    redirect("/partner")
  }

  return (
    <div className="page-container max-w-lg space-y-6">
      <PageHeader
        title="Vínculo da organização pendente"
        description="Seu perfil de parceiro existe, mas ainda não está vinculado a uma organização na rede."
      />

      <Card>
        <CardContent className="space-y-4 py-8 text-sm text-muted-foreground">
          <p>
            Para acessar o portal parceiro, é necessário concluir o vínculo entre seu
            usuário e a organização (<code className="text-xs">linkedPartnerId</code>).
          </p>
          <p>
            Se você acabou de se cadastrar, finalize o onboarding. Caso sua organização
            já exista, entre em contato com o suporte Peteen para concluir o vínculo.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/onboarding/partner" className={buttonVariants({ size: "sm" })}>
              Ir para onboarding
            </Link>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Voltar ao início
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
