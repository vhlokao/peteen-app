import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { getTutorPortalData } from "@/modules/tutor-portal/infrastructure/queries"
import { TutorStatsGrid } from "@/modules/tutor-portal/components/tutor-stats-grid"
import { TutorRecentActivity } from "@/modules/tutor-portal/components/tutor-recent-activity"
import { TutorNextActions } from "@/modules/tutor-portal/components/tutor-next-actions"
import { HiredProfessionalsBlock } from "@/modules/tutor-portal/components/hired-professionals-block"
import { requireAuth } from "@/modules/identity/application/get-session"

export const metadata: Metadata = {
  title: "Portal do tutor",
}

export default async function TutorDashboardPage() {
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  const portal = await getTutorPortalData(tutorProfile.id)

  return (
    <div className="page-container space-y-8">
      <PageHeader
        title={`Olá, ${tutorProfile.displayName.split(" ")[0]}`}
        description="Visão geral da sua jornada — pets, solicitações e profissionais."
        action={
          <Link href="/discover" className={buttonVariants({ size: "sm" })}>
            Descobrir profissionais
          </Link>
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Resumo
        </h2>
        <TutorStatsGrid stats={portal.stats} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <TutorNextActions actions={portal.nextActions} />
        <TutorRecentActivity items={portal.recentActivity} />
      </div>

      <HiredProfessionalsBlock professionals={portal.hiredProfessionals} />
    </div>
  )
}
