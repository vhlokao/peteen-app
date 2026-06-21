import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { requireAdmin } from "@/modules/identity/application/get-session"
import { getPartnerById } from "@/modules/partners/infrastructure/repository"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { PartnerForm } from "@/components/admin/PartnerForm"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const partner = await getPartnerById(id)
  return { title: partner ? `Editar — ${partner.businessName}` : "Parceiro" }
}

export default async function AdminPartnerEditPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params
  const partner = await getPartnerById(id)

  if (!partner) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/admin/partners"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar para parceiros
      </Link>

      <AdminPageHeader
        title={`Editar: ${partner.businessName}`}
        description="Alterações refletem no perfil público e nas recomendações."
      />

      {partner.isActive && (
        <p className="text-sm text-muted-foreground">
          Perfil público:{" "}
          <Link href={`/partners/${partner.slug}`} target="_blank" className="font-medium text-primary hover:underline">
            /partners/{partner.slug}
          </Link>
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <PartnerForm partner={partner} />
      </div>
    </div>
  )
}
