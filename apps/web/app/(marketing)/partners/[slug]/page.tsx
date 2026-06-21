import type { Metadata } from "next"

import Link from "next/link"

import { notFound } from "next/navigation"

import { ArrowLeft, MapPin, Phone, Globe, ShieldCheck, Users, Link2, Sparkles } from "lucide-react"



import { getPartnerPublicProfileAction } from "@/modules/partners/application/actions"

import { PARTNER_CATEGORY_LABELS, PARTNER_VERIFICATION_STATUS_LABELS } from "@/modules/partners/domain/constants"
import { isPartnerVerificationActive } from "@/modules/verification/domain/verification-state"

import { activationScoreLabel } from "@/modules/partners/domain/activation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { PageHeader } from "@/components/layout/page-header"



type Props = {

  params: Promise<{ slug: string }>

}



export async function generateMetadata({ params }: Props): Promise<Metadata> {

  const { slug } = await params

  const profile = await getPartnerPublicProfileAction(slug)

  if (!profile) return { title: "Parceiro" }

  return { title: profile.businessName }

}



export default async function PartnerPublicPage({ params }: Props) {

  const { slug } = await params

  const partner = await getPartnerPublicProfileAction(slug)



  if (!partner) notFound()



  const verificationActive = isPartnerVerificationActive(partner)

  const { operationalMetrics } = partner

  const activationScore = operationalMetrics.activationScore



  const initials = partner.businessName

    .split(" ")

    .slice(0, 2)

    .map((w) => w[0])

    .join("")

    .toUpperCase()



  return (

    <div className="page-container max-w-2xl">

      <Link

        href="/discover"

        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"

      >

        <ArrowLeft className="size-4" />

        Voltar

      </Link>



      <PageHeader

        title={partner.businessName}

        description={PARTNER_CATEGORY_LABELS[partner.category]}

      />



      <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-start">

        <Avatar className="size-20 shrink-0">

          {partner.logoUrl && <AvatarImage src={partner.logoUrl} alt={partner.businessName} />}

          <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">

            {initials}

          </AvatarFallback>

        </Avatar>



        <div className="flex-1 space-y-3">

          <div className="flex flex-wrap items-center gap-2">

            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">

              {PARTNER_CATEGORY_LABELS[partner.category]}

            </span>

            {verificationActive && (

              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">

                <ShieldCheck className="size-3" />

                ✓ Parceiro Verificado

              </span>

            )}

            {partner.verificationStatus === "PENDING_VERIFICATION" && !verificationActive && (

              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">

                <Sparkles className="size-3" />

                {PARTNER_VERIFICATION_STATUS_LABELS.PENDING_VERIFICATION}

              </span>

            )}

          </div>



          <div className="flex items-center gap-1 text-sm text-muted-foreground">

            <MapPin className="size-3.5 shrink-0" />

            {partner.city}, {partner.state}

          </div>



          {partner.description && (

            <p className="text-sm leading-relaxed text-foreground">{partner.description}</p>

          )}



          <div className="flex flex-wrap gap-4 text-sm">

            {partner.phone && (

              <span className="inline-flex items-center gap-1.5 text-muted-foreground">

                <Phone className="size-3.5" /> {partner.phone}

              </span>

            )}

            {partner.website && (

              <a

                href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}

                target="_blank"

                rel="noopener noreferrer"

                className="inline-flex items-center gap-1.5 text-primary hover:underline"

              >

                <Globe className="size-3.5" /> Website

              </a>

            )}

            {partner.instagram && (

              <span className="inline-flex items-center gap-1.5 text-muted-foreground">

                {partner.instagram}

              </span>

            )}

          </div>

        </div>

      </div>



      {/* Nível de Ativação */}

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">

        <div className="mb-3 flex items-center justify-between">

          <h2 className="text-sm font-semibold text-foreground">Nível de Ativação</h2>

          <span className="text-sm font-bold tabular-nums text-primary">

            {activationScore}% — {activationScoreLabel(activationScore)}

          </span>

        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">

          <div

            className="h-full rounded-full bg-primary transition-all"

            style={{ width: `${activationScore}%` }}

          />

        </div>

        <div className="grid gap-3 sm:grid-cols-2">

          <MetricCard

            icon={<Users className="size-4 text-primary" />}

            label="Profissionais recomendados"

            value={operationalMetrics.recommendedProfessionals}

          />

          <MetricCard

            icon={<Link2 className="size-4 text-primary" />}

            label="Trust connections ativas"

            value={operationalMetrics.activeConnections}

          />

        </div>

      </section>



      <section className="rounded-2xl border border-border bg-card p-5">

        <h2 className="mb-4 text-sm font-semibold text-foreground">

          Profissionais recomendados

        </h2>



        {partner.recommendedProfessionals.length === 0 ? (

          <p className="text-sm text-muted-foreground">

            Este parceiro ainda não recomendou profissionais na rede.

          </p>

        ) : (

          <div className="space-y-3">

            {partner.recommendedProfessionals.map((pro) => (

              <Link

                key={pro.professionalId}

                href={`/discover/${pro.professionalId}`}

                className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"

              >

                <Avatar className="size-10">

                  {pro.avatarUrl && <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />}

                  <AvatarFallback className="text-xs">{pro.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>

                </Avatar>

                <div className="min-w-0 flex-1">

                  <p className="font-medium text-foreground">{pro.displayName}</p>

                  <p className="text-xs text-muted-foreground">{pro.city} · Trust {pro.trustScore.toFixed(0)}</p>

                </div>

              </Link>

            ))}

          </div>

        )}

      </section>

    </div>

  )

}



function MetricCard({

  icon,

  label,

  value,

}: {

  icon: React.ReactNode

  label: string

  value: number

}) {

  return (

    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">

      {icon}

      <div>

        <p className="text-lg font-bold tabular-nums">{value}</p>

        <p className="text-xs text-muted-foreground">{label}</p>

      </div>

    </div>

  )

}

