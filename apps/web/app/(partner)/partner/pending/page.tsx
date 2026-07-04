import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LinkIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { requireAuth } from "@/modules/identity/application/get-session"
import { findPartnerProfileByUserId } from "@/modules/partner-portal/infrastructure/repository"

export const metadata: Metadata = {
  title: "Pendências — Parceiro",
}

/**
 * /partner/pending — UX 3.9.
 *
 * Auditoria confirmou: não existe "recomendação pendente de análise" no
 * modelo (uma recomendação nasce ativa, ver domain/status-display.ts).
 * Esta rota trata de um estado real diferente: o perfil de parceiro do
 * usuário ainda não foi vinculado a uma organização (linkedPartnerId
 * nulo) — só nesse caso requirePartnerContext redireciona para cá. O
 * conteúdo abaixo reflete essa realidade, só com o visual atualizado.
 */
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
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Pendências</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe o que ainda precisa de ação para acessar o portal parceiro.
        </p>
      </header>

      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/[0.02] p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <LinkIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Próximo passo
            </p>
            <p className="mt-0.5 text-base font-semibold text-foreground">
              Vínculo com a organização pendente
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Seu perfil de parceiro existe, mas ainda não está vinculado a uma organização na
          rede. Se você acabou de se cadastrar, finalize o onboarding. Caso sua organização
          já exista, entre em contato com o suporte Peteen para concluir o vínculo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/onboarding/partner" className={buttonVariants({ size: "sm" })}>
            Ir para onboarding
          </Link>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Voltar ao início
          </Link>
        </div>
      </section>
    </div>
  )
}
