import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PetForm } from "@/modules/pets/components/pet-form"
import { ArchivePetButton } from "@/modules/pets/components/archive-pet-button"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { findPetByIdAndTutorId } from "@/modules/pets/infrastructure/repository"
import { requireAuth } from "@/modules/identity/application/get-session"

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)
  if (!tutorProfile) return { title: "Pet" }

  const pet = await findPetByIdAndTutorId(id, tutorProfile.id, {
    includeArchived: true,
  })
  return { title: pet ? pet.name : "Pet" }
}

export default async function EditPetPage({ params }: PageProps) {
  const { id } = await params
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  const pet = await findPetByIdAndTutorId(id, tutorProfile.id, {
    includeArchived: true,
  })

  if (!pet) {
    notFound()
  }

  if (!pet.isActive) {
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
        <PageHeader title={pet.name} description="Este pet foi arquivado." />
        <Badge variant="secondary">Arquivado</Badge>
      </div>
    )
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
        title={pet.name}
        description="Atualize os dados do seu pet."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Editar pet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PetForm
            mode="edit"
            pet={pet}
            redirectTo="/me/pets"
            showSkip={false}
          />
          <ArchivePetButton petId={pet.id} petName={pet.name} />
        </CardContent>
      </Card>
    </div>
  )
}
