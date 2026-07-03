import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SPECIES_EMOJI, SPECIES_LABELS, type Species } from "@/modules/tutor/domain/types"

type TutorPetPreviewProps = {
  id: string
  name: string
  species: Species
  breed: string | null
  avatarUrl: string | null
}

export function TutorPetPreview({ id, name, species, breed, avatarUrl }: TutorPetPreviewProps) {
  return (
    <Link
      href={`/me/pets/${id}`}
      className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm transition-shadow hover:shadow-md"
    >
      <Avatar className="size-14">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="bg-primary/10 text-base text-primary">
          {SPECIES_EMOJI[species]}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{name}</p>
        <p className="truncate text-[0.65rem] text-muted-foreground">
          {breed || SPECIES_LABELS[species]}
        </p>
      </div>
    </Link>
  )
}
