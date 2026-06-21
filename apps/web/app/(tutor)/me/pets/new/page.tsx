import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PetForm } from "@/modules/pets/components/pet-form"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { requireAuth } from "@/modules/identity/application/get-session"

export const metadata: Metadata = {
  title: "Novo pet",
}

export default async function NewPetPage() {
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-4">
        <Link
          href="/me/pets"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1" })}
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Link>
      </div>
      <PageHeader
        title="Adicionar pet"
        description="Quanto mais contexto, melhores as recomendações e solicitações."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do pet</CardTitle>
        </CardHeader>
        <CardContent>
          <PetForm mode="create" redirectTo="/me/pets" showSkip={false} />
        </CardContent>
      </Card>
    </div>
  )
}
