import Link from "next/link"
import { PawPrint } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { SPECIES_EMOJI, SPECIES_LABELS, type PetData } from "@/modules/tutor/domain/types"
import { cn } from "@/lib/utils"

function calculateAge(birthDate: Date | null): string | null {
  if (!birthDate) return null
  const now = new Date()
  const birth = new Date(birthDate)
  let years = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1
  }
  if (years <= 0) {
    const months =
      (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
    return months <= 1 ? "Filhote" : `${months} meses`
  }
  return years === 1 ? "1 ano" : `${years} anos`
}

type RequestPetStepProps = {
  pets: PetData[]
  selectedPetId: string
  onSelect: (petId: string) => void
  error?: string
}

/**
 * Etapa 1 — escolha do pet. Cards grandes e clicáveis (não select).
 * Nenhum dado inventado: idade é calculada a partir de birthDate real,
 * quando existir; se não existir, o campo simplesmente não aparece.
 */
export function RequestPetStep({ pets, selectedPetId, onSelect, error }: RequestPetStepProps) {
  if (pets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PawPrint className="size-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Nenhum pet cadastrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cadastre um pet para poder solicitar um atendimento.
          </p>
        </div>
        <Link href="/me/pets/new" className={buttonVariants({ size: "sm" })}>
          Adicionar pet
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-2.5">
        {pets.map((pet) => {
          const active = pet.id === selectedPetId
          const age = calculateAge(pet.birthDate)
          return (
            <button
              key={pet.id}
              type="button"
              onClick={() => onSelect(pet.id)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                active
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-card)]"
                  : "border-border hover:border-primary/30 hover:bg-muted/40"
              )}
            >
              <Avatar className="size-14 shrink-0 rounded-xl">
                {pet.avatarUrl && <AvatarImage src={pet.avatarUrl} alt={pet.name} />}
                <AvatarFallback className="rounded-xl bg-primary/10 text-lg">
                  {SPECIES_EMOJI[pet.species]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{pet.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[pet.breed || SPECIES_LABELS[pet.species], age].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  active ? "border-primary bg-primary" : "border-border"
                )}
                aria-hidden
              >
                {active && <span className="size-1.5 rounded-full bg-primary-foreground" />}
              </div>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
