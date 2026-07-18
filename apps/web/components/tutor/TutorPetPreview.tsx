import Link from "next/link"
import { Plus } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SPECIES_EMOJI, SPECIES_LABELS, type Species } from "@/modules/tutor/domain/types"

const NAVY_SOFT = "#2C4893"
const CORAL = "#E07A5F"

type TutorPetPreviewProps = {
  id: string
  name: string
  species: Species
  breed: string | null
  avatarUrl: string | null
}

export function TutorPetPreview({ id, name, species, breed, avatarUrl }: TutorPetPreviewProps) {
  const isCat = species === "CAT"

  return (
    <Link
      href={`/me/pets/${id}`}
      className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-[18px] border border-border bg-card p-3.5 text-center"
    >
      <Avatar className="size-[46px]" style={isCat ? { background: "#FBEDE8" } : { background: "#E8EEF6" }}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback
          className="bg-transparent text-lg"
          style={{ color: isCat ? CORAL : NAVY_SOFT }}
        >
          {SPECIES_EMOJI[species]}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-bold text-foreground">{name}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">
          {breed || SPECIES_LABELS[species]}
        </p>
      </div>
    </Link>
  )
}

/** Tile de adicionar pet — aparece sempre ao final da lista, com ao menos 1 pet ou não. */
export function TutorAddPetTile() {
  return (
    <Link
      href="/me/pets/new"
      aria-label="Adicionar pet"
      className="grid w-[66px] shrink-0 place-items-center rounded-[18px] border-[1.5px] border-dashed border-border"
      style={{ color: NAVY_SOFT }}
    >
      <Plus className="size-[22px]" />
    </Link>
  )
}
