import Link from "next/link"

import { ExternalLink } from "lucide-react"



import { getAllProfessionalBadgeSummaries } from "@/modules/badges/application/get-professional-badges"

import { AdminPageHeader } from "@/components/admin/AdminPageHeader"

import { requireAdmin } from "@/modules/identity/application/get-session"

import { getPendingProfessionalVerificationEntityIds, getSuspendedProfessionalEntityIds } from "@/modules/verification/infrastructure/repository"
import { prepareVerificationQueue } from "@/modules/verification/application/prepare-queue"



export const metadata = { title: "Admin — Status dos Profissionais" }



function VerificationStatusLabel({

  isVerificationActive,

  hasPendingRequest,

  isSuspended,

}: {

  isVerificationActive: boolean

  hasPendingRequest: boolean

  isSuspended: boolean

}) {

  if (isVerificationActive) {

    return <span className="text-xs font-medium text-emerald-600">Verificado</span>

  }

  if (isSuspended) {

    return (

      <span className="text-xs font-medium text-orange-700 dark:text-orange-400">

        Suspenso

      </span>

    )

  }

  if (hasPendingRequest) {

    return (

      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">

        Pendente

      </span>

    )

  }

  return <span className="text-xs text-neutral-500">Não verificado</span>

}



export default async function AdminBadgesPage() {

  await requireAdmin()

  await prepareVerificationQueue()

  const [summaries, pendingIds, suspendedIds] = await Promise.all([

    getAllProfessionalBadgeSummaries(),

    getPendingProfessionalVerificationEntityIds(),

    getSuspendedProfessionalEntityIds(),

  ])



  const verifiedCount = summaries.filter((s) => s.isVerificationActive).length

  const pendingCount = summaries.filter(

    (s) => !s.isVerificationActive && pendingIds.has(s.professionalId)

  ).length

  const suspendedCount = summaries.filter(

    (s) => !s.isVerificationActive && suspendedIds.has(s.professionalId)

  ).length



  return (

    <div className="space-y-6">

      <AdminPageHeader

        title="Status dos Profissionais"

        description="Veja badges automáticos, reputação e status de verificação dos profissionais."

        actions={

          <Link

            href="/admin/verifications"

            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"

          >

            Fila de Verificações

            <ExternalLink className="size-3" />

          </Link>

        }

      />



      <div className="flex flex-wrap gap-4">

        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4">

          <p className="text-xs uppercase tracking-wide text-neutral-400">Profissionais</p>

          <p className="mt-1 text-2xl font-bold text-neutral-800">{summaries.length}</p>

        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">

          <p className="text-xs uppercase tracking-wide text-emerald-500">Verificados</p>

          <p className="mt-1 text-2xl font-bold text-emerald-700">{verifiedCount}</p>

        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">

          <p className="text-xs uppercase tracking-wide text-amber-600">Pendentes na fila</p>

          <p className="mt-1 text-2xl font-bold text-amber-700">{pendingCount}</p>

        </div>

        <div className="rounded-lg border border-orange-200 bg-orange-50 px-5 py-4">

          <p className="text-xs uppercase tracking-wide text-orange-600">Suspensos</p>

          <p className="mt-1 text-2xl font-bold text-orange-700">{suspendedCount}</p>

        </div>

      </div>



      <div className="overflow-x-auto rounded-lg border border-neutral-200">

        <table className="min-w-full divide-y divide-neutral-100 text-sm">

          <thead className="bg-neutral-50">

            <tr>

              {["Profissional", "Cidade", "Trust", "Reviews", "Atendimentos", "Badges", "Status verificação"].map((h) => (

                <th

                  key={h}

                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500"

                >

                  {h}

                </th>

              ))}

            </tr>

          </thead>

          <tbody className="divide-y divide-neutral-50 bg-white">

            {summaries.length === 0 && (

              <tr>

                <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">

                  Nenhum profissional cadastrado.

                </td>

              </tr>

            )}

            {summaries.map((s) => (

              <tr key={s.professionalId} className="hover:bg-neutral-50">

                <td className="px-4 py-3 font-medium text-neutral-800">{s.displayName}</td>

                <td className="px-4 py-3 text-xs text-neutral-500">{s.city}</td>

                <td className="px-4 py-3 text-xs font-semibold text-neutral-700 tabular-nums">

                  {s.trustScore.toFixed(0)}

                </td>

                <td className="px-4 py-3 text-xs text-neutral-600 tabular-nums">{s.reviewCount}</td>

                <td className="px-4 py-3 text-xs text-neutral-600 tabular-nums">

                  {s.completedServices}

                </td>

                <td className="px-4 py-3">

                  {s.badges.length === 0 ? (

                    <span className="text-xs text-neutral-400">—</span>

                  ) : (

                    <div className="flex flex-wrap gap-1">

                      {s.badges.map((b) => (

                        <span

                          key={b.type}

                          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[0.6rem] font-medium text-neutral-700"

                          title={b.description}

                        >

                          <span aria-hidden>{b.emoji}</span>

                          {b.label}

                        </span>

                      ))}

                    </div>

                  )}

                </td>

                <td className="px-4 py-3">

                  <VerificationStatusLabel

                    isVerificationActive={s.isVerificationActive}

                    hasPendingRequest={pendingIds.has(s.professionalId)}

                    isSuspended={suspendedIds.has(s.professionalId)}

                  />

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>



      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">

          Regras dos badges (automáticos)

        </p>

        <div className="grid gap-1 text-xs text-neutral-500 sm:grid-cols-2">

          <span>🌱 <strong>Primeiro Cliente</strong> — completedServices ≥ 1</span>

          <span>🔄 <strong>Recorrente</strong> — completedServices ≥ 3</span>

          <span>🛡️ <strong>Confiável</strong> — Trust Score ≥ 25</span>

          <span>⭐ <strong>Muito Bem Avaliado</strong> — 5+ reviews com média ≥ 4.5</span>

          <span>🏆 <strong>Especialista</strong> — 10+ reviews</span>

          <span>✓ <strong>Perfil Verificado</strong> — aprovado na Fila de Verificações</span>

        </div>

      </div>

    </div>

  )

}

