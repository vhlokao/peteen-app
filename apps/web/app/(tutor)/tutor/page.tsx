import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Building2,
  Footprints,
  GraduationCap,
  HeartHandshake,
  House,
  Search,
} from "lucide-react"

import { requireAuth } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { findHiredProfessionalsByTutorId } from "@/modules/tutor-portal/infrastructure/queries"
import { findRecentPetsByTutorId } from "@/modules/pets/infrastructure/repository"
import { getMyRequestsAsTutorAction } from "@/modules/service-request/application/actions"
import { REQUEST_STATUS_LABELS } from "@/modules/service-request/domain/types"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { TutorHeroCard } from "@/components/tutor/TutorHeroCard"
import {
  TutorActiveRequestCard,
  TutorEmptyActiveRequestCard,
  type TutorActiveRequestSummary,
} from "@/components/tutor/TutorActiveRequestCard"
import { TutorPetPreview, TutorAddPetTile } from "@/components/tutor/TutorPetPreview"
import { TutorCareCategoryCard } from "@/components/tutor/TutorCareCategoryCard"
import { TutorTrustNetworkCard } from "@/components/tutor/TutorTrustNetworkCard"

export const metadata: Metadata = {
  title: "Portal do tutor",
}

const NAVY_SOFT = "#2C4893"

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

/** Saudação por horário — apresentação pura, sem query nova. */
function greetingForHour(hour: number): string {
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

/**
 * /tutor — Home mobile-first do tutor (UX 3.3, reskin visual).
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
  const greeting = greetingForHour(new Date().getHours())

  return (
    <div className="page-container space-y-7 pb-4">
      <TutorHeroCard firstName={firstName} greeting={greeting} />

      <section>
        <p className="mb-2.5 text-xs font-extrabold tracking-[.05em] text-muted-foreground">
          PRÓXIMO ATENDIMENTO
        </p>
        {activeRequest ? (
          <TutorActiveRequestCard request={activeRequest} />
        ) : (
          <TutorEmptyActiveRequestCard />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15.5px] font-extrabold tracking-[-0.01em] text-foreground">
            Meus pets
          </h2>
          <Link
            href="/me/pets"
            className="text-[12.5px] font-bold"
            style={{ color: NAVY_SOFT }}
          >
            Gerenciar
          </Link>
        </div>

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
          <TutorAddPetTile />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15.5px] font-extrabold tracking-[-0.01em] text-foreground">
          Tipos de cuidado
        </h2>
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

      {hiredProfessionals.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15.5px] font-extrabold tracking-[-0.01em] text-foreground">
            Sua rede de confiança
          </h2>
          <TutorTrustNetworkCard professionals={hiredProfessionals} />
        </section>
      )}
      {hiredProfessionals.length === 0 && (
        <TutorTrustNetworkCard professionals={hiredProfessionals} />
      )}

      <Link
        href="/discover"
        className="flex w-full items-center gap-3.5 rounded-[20px] p-5 text-left transition-transform active:scale-[.99]"
        style={{ background: "linear-gradient(135deg,#E8EEF6,#F6EEEA)" }}
      >
        <span className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-white shadow-[0_6px_14px_rgba(29,47,111,.10)]">
          <Search className="size-[22px]" style={{ color: NAVY_SOFT }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-bold leading-tight text-foreground">
            Precisa de ajuda com seu pet?
          </span>
          <span className="block text-[12.5px] text-muted-foreground">
            Encontre profissionais confiáveis perto de você.
          </span>
        </span>
      </Link>
    </div>
  )
}
