import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { PetList } from "@/modules/pets/components/pet-list"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { findActivePetsByTutorId } from "@/modules/pets/infrastructure/repository"
import { requireAuth } from "@/modules/identity/application/get-session"

export const metadata: Metadata = {
  title: "Meus pets",
}

export default async function MyPetsPage() {
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  const pets = await findActivePetsByTutorId(tutorProfile.id)

  return (
    <div className="page-container">
      <PageHeader
        title="Pets"
        description="Perfis dos seus pets para contexto em solicitações e recomendações."
        action={
          pets.length > 0 ? (
            <Link
              href="/me/pets/new"
              className={buttonVariants({ className: "gap-2" })}
            >
              <Plus className="size-4" />
              Adicionar pet
            </Link>
          ) : null
        }
      />
      <PetList pets={pets} />
    </div>
  )
}
