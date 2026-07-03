import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Building2,
  Footprints,
  GraduationCap,
  HeartHandshake,
  House,
  PawPrint,
  PlusCircle,
} from "lucide-react"

import { requireAuth } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { findHiredProfessionalsByTutorId } from "@/modules/tutor-portal/infrastructure/queries"
import { findRecentPetsByTutorId } from "@/modules/pets/infrastructure/repository"
import { getMyRequestsAsTutorAction } from "@/modules/service-request/application/actions"
import { REQUEST_STATUS_LABELS } from "@/modules/service-request/domain/types"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { buttonVariants } from "@/components/ui/button"
import { TutorHeroCard } from "@/components/tutor/TutorHeroCard"
import {
  TutorActiveRequestCard,
  type TutorActiveRequestSummary,
} from "@/components/tutor/TutorActiveRequestCard"
import { TutorPetPreview } from "@/components/tutor/TutorPetPreview"
import { TutorCareCategoryCard } from "@/components/tutor/TutorCareCategoryCard"
import { TutorTrustNetworkCard } from "@/components/tutor/TutorTrustNetworkCard"

export const metadata: Metadata = {
  title: "Portal do tutor",
}

const OPEN_STATUSES = new Set(["PENDING", "ACCEPTED", "IN_PROGRESS"])

const STATUS_TONE: Record<string, TutorActiveRequestSummary["statusTone"]> = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  IN_PROGRESS: "in_progress",
}

/**
 * Tipos de cuidado em destaque — subconjunto curado de SERVICE_TYPES com
 * labels reais (nenhum label inventado). Cada chip aponta para /discover
 * com o filtro serviceType já suportado pela página de busca.
 */
const CARE_CATEGORIES: { type: ServiceType; icon: typeof Footprints }[] = [
  { type: "DOG_WALK", icon: Footprints },
  { type: "PET_SITTING", icon: House },
  { type: "BOARDING", icon: Building2 },
  { type: "TRAINING", icon: GraduationCap },
  { type: "HOME_CARE", icon: HeartHandshake },
]

/**
 * /tutor — Home mobile-first do tutor (UX 3.3).
 *
 * Responde "o que eu posso fazer agora para cuidar do meu pet?" — não é
 * dashboard. Todo bloco usa dado real já disponível via infraestrutura
 * existente (nenhuma query nova pesada, nenhuma Server Action nova):
 *
 *  - findHiredProfessionalsByTutorId — já existia (tutor-portal)
 *  - findRecentPetsByTutorId          — já existia (pets)
 *  - getMyRequestsAsTutorAction        — já existia (service-request)
 */
export default async function TutorDashboardPage() {
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  const [hiredProfessionals, pets, requestsResult] = await Promise.all([
    findHiredProfessionalsByTutorId(tutorProfile.id),
    findRecentPetsByTutorId(tutorProfile.id, 4),
    getMyRequestsAsTutorAction({ limit: 10 }),
  ])

  const requests = requestsResult.success ? requestsResult.data : []
  const activeRequestRaw = requests.find((r) => OPEN_STATUSES.has(r.status)) ?? null

  const activeRequest: TutorActiveRequestSummary | null = activeRequestRaw
    ? {
        id: activeRequestRaw.id,
        professionalName: activeRequestRaw.professional.displayName,
        professionalCity: activeRequestRaw.professional.city,
        professionalAvatarUrl: activeRequestRaw.professional.avatarUrl,
        serviceLabel: SERVICE_TYPE_LABELS[activeRequestRaw.serviceType as ServiceType],
        statusLabel: REQUEST_STATUS_LABELS[activeRequestRaw.status],
        statusTone: STATUS_TONE[activeRequestRaw.status] ?? "pending",
        petName: activeRequestRaw.pet?.name ?? null,
      }
    : null

  const firstName = tutorProfile.displayName.split(" ")[0] || "tutor"

  return (
    <div className="page-container space-y-8 pb-4">
      <TutorHeroCard firstName={firstName} />

      {activeRequest && <TutorActiveRequestCard request={activeRequest} />}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Meus pets</h2>
          <Link href="/me/pets" className="text-xs font-medium text-primary hover:underline">
            Gerenciar pets
          </Link>
        </div>

        {pets.length > 0 ? (
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {pets.map((pet) => (
              <TutorPetPreview
                key={pet.id}
                id={pet.id}
                name={pet.name}
                species={pet.species}
                breed={pet.breed}
                avatarUrl={pet.avatarUrl}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <PawPrint className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Nenhum pet cadastrado</p>
              <p className="text-xs text-muted-foreground">
                Cadastre seu pet para pedir cuidados.
              </p>
            </div>
            <Link
              href="/me/pets/new"
              className={buttonVariants({
                size: "sm",
                variant: "outline",
                className: "shrink-0 gap-1",
              })}
            >
              <PlusCircle className="size-3.5" />
              Adicionar
            </Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Tipos de cuidado</h2>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {CARE_CATEGORIES.map((category) => (
            <TutorCareCategoryCard
              key={category.type}
              label={SERVICE_TYPE_LABELS[category.type]}
              href={`/discover?serviceType=${category.type}`}
              icon={category.icon}
            />
          ))}
        </div>
      </section>

      <TutorTrustNetworkCard professionals={hiredProfessionals} />
    </div>
  )
}
