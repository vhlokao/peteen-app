import type { Metadata } from "next"

import Link from "next/link"

import { Handshake, ExternalLink } from "lucide-react"



import { requireAdmin } from "@/modules/identity/application/get-session"

import { getAdminPartnersAction } from "@/modules/partners/application/actions"

import {

  PARTNER_CATEGORY_LABELS,

  PARTNER_ONBOARDING_STATUS_LABELS,

  PARTNER_VERIFICATION_STATUS_LABELS,

} from "@/modules/partners/domain/constants"

import { activationScoreLabel } from "@/modules/partners/domain/activation"

import { AdminPageHeader } from "@/components/admin/AdminPageHeader"

import { PartnerForm } from "@/components/admin/PartnerForm"

import { TogglePartnerActiveButton } from "@/components/admin/TogglePartnerActiveButton"



export const metadata: Metadata = { title: "Admin — Parceiros" }

export const dynamic = "force-dynamic"



type Props = {

  searchParams: Promise<{ onboarding?: string }>

}



export default async function AdminPartnersPage({ searchParams }: Props) {

  await requireAdmin()

  const { onboarding } = await searchParams



  const onboardingFilter =

    onboarding === "completed"

      ? ("completed" as const)

      : onboarding === "incomplete"

        ? ("incomplete" as const)

        : undefined



  const partners = await getAdminPartnersAction({ onboardingFilter })



  const activeCount = partners.filter((p) => p.isActive).length

  const verifiedCount = partners.filter((p) => p.isVerified && p.isActive).length

  const onboardingCompleted = partners.filter((p) => p.onboardingStatus === "COMPLETED").length



  return (

    <div className="space-y-6">

      <AdminPageHeader

        title="Parceiros"

        description="Estabelecimentos e instituições que constroem confiança na rede Peteen."

      />



      <div className="grid gap-3 sm:grid-cols-4">

        <div className="rounded-xl border border-border bg-card p-4">

          <p className="text-2xl font-black tabular-nums">{partners.length}</p>

          <p className="text-xs text-muted-foreground">Total cadastrados</p>

        </div>

        <div className="rounded-xl border border-border bg-card p-4">

          <p className="text-2xl font-black tabular-nums text-green-600">{activeCount}</p>

          <p className="text-xs text-muted-foreground">Ativos</p>

        </div>

        <div className="rounded-xl border border-border bg-card p-4">

          <p className="text-2xl font-black tabular-nums text-primary">{verifiedCount}</p>

          <p className="text-xs text-muted-foreground">Verificados</p>

        </div>

        <div className="rounded-xl border border-border bg-card p-4">

          <p className="text-2xl font-black tabular-nums">{onboardingCompleted}</p>

          <p className="text-xs text-muted-foreground">Onboarding concluído</p>

        </div>

      </div>



      <div className="flex flex-wrap items-center gap-2">

        <span className="text-xs text-muted-foreground">Onboarding:</span>

        {[

          { href: "/admin/partners", label: "Todos", active: !onboardingFilter },

          { href: "/admin/partners?onboarding=incomplete", label: "Incompleto", active: onboardingFilter === "incomplete" },

          { href: "/admin/partners?onboarding=completed", label: "Concluído", active: onboardingFilter === "completed" },

        ].map(({ href, label, active }) => (

          <Link

            key={href}

            href={href}

            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${

              active

                ? "bg-primary text-primary-foreground"

                : "border border-border text-muted-foreground hover:border-primary/30"

            }`}

          >

            {label}

          </Link>

        ))}

        <Link

          href="/onboarding/partner"

          target="_blank"

          className="ml-auto text-xs font-medium text-primary hover:underline"

        >

          Abrir onboarding público →

        </Link>

      </div>



      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">

        <h3 className="mb-4 text-sm font-semibold">Novo parceiro</h3>

        <PartnerForm />

      </div>



      <div className="overflow-x-auto rounded-2xl border border-border">

        <table className="w-full text-sm">

          <thead className="border-b border-border bg-muted/40">

            <tr>

              {[

                "Negócio",

                "Categoria",

                "Cidade",

                "Onboarding",

                "Ativação",

                "Recom.",

                "Verificação",

                "Perfil",

                "Status",

                "Ações",

              ].map((h) => (

                <th

                  key={h}

                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"

                >

                  {h}

                </th>

              ))}

            </tr>

          </thead>

          <tbody className="divide-y divide-border">

            {partners.length === 0 && (

              <tr>

                <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">

                  <Handshake className="mx-auto mb-2 size-8 opacity-30" />

                  Nenhum parceiro cadastrado.

                </td>

              </tr>

            )}

            {partners.map((p) => (

              <tr key={p.id} className={`hover:bg-muted/20 ${!p.isActive ? "opacity-50" : ""}`}>

                <td className="px-4 py-3">

                  <p className="font-medium">{p.businessName}</p>

                  <p className="font-mono text-[0.65rem] text-muted-foreground">{p.slug}</p>

                </td>

                <td className="px-4 py-3 text-xs text-muted-foreground">

                  {PARTNER_CATEGORY_LABELS[p.category]}

                </td>

                <td className="px-4 py-3 text-xs">

                  {p.city}, {p.state}

                </td>

                <td className="px-4 py-3">

                  <OnboardingBadge status={p.onboardingStatus} />

                </td>

                <td className="px-4 py-3">

                  <span className="text-xs font-semibold tabular-nums">

                    {p.activationScore}%

                  </span>

                  <span className="ml-1 text-[0.65rem] text-muted-foreground">

                    ({activationScoreLabel(p.activationScore)})

                  </span>

                </td>

                <td className="px-4 py-3 text-center text-xs tabular-nums">{p.recommendationCount}</td>

                <td className="px-4 py-3 text-xs">

                  {p.isVerified ? (

                    <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">

                      Verificado

                    </span>

                  ) : p.verificationStatus === "PENDING_VERIFICATION" ? (

                    <span className="rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">

                      {PARTNER_VERIFICATION_STATUS_LABELS.PENDING_VERIFICATION}

                    </span>

                  ) : (

                    <span className="text-muted-foreground">—</span>

                  )}

                </td>

                <td className="px-4 py-3">

                  {p.isActive && (

                    <Link

                      href={`/partners/${p.slug}`}

                      target="_blank"

                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"

                    >

                      Ver <ExternalLink className="size-3" />

                    </Link>

                  )}

                </td>

                <td className="px-4 py-3 text-right">

                  <TogglePartnerActiveButton id={p.id} isActive={p.isActive} />

                </td>

                <td className="px-4 py-3">

                  <Link

                    href={`/admin/partners/${p.id}`}

                    className="text-xs font-medium text-primary hover:underline"

                  >

                    Editar

                  </Link>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>

  )

}



function OnboardingBadge({ status }: { status: keyof typeof PARTNER_ONBOARDING_STATUS_LABELS }) {

  const label = PARTNER_ONBOARDING_STATUS_LABELS[status]

  const styles =

    status === "COMPLETED"

      ? "bg-green-500/10 text-green-700 dark:text-green-400"

      : status === "IN_PROGRESS"

        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"

        : "bg-muted text-muted-foreground"



  return (

    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles}`}>{label}</span>

  )

}

