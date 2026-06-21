import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TutorProfileEditForm } from "@/modules/tutor/components/tutor-profile-edit-form"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { requireAuth } from "@/modules/identity/application/get-session"

export const metadata: Metadata = {
  title: "Meu perfil",
}

export default async function TutorProfilePage() {
  const session = await requireAuth()
  const profile = await findTutorProfileByUserId(session.id)

  if (!profile) {
    redirect("/onboarding/tutor")
  }

  return (
    <div className="page-container max-w-2xl">
      <PageHeader
        title="Meu perfil"
        description="Suas informações de contato e localização para profissionais."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do tutor</CardTitle>
        </CardHeader>
        <CardContent>
          <TutorProfileEditForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
