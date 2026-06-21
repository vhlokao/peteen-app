"use client"

import Link from "next/link"
import { PawPrint, Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  SPECIES_EMOJI,
  SPECIES_LABELS,
  type PetData,
} from "@/modules/pets/domain/types"

type PetCardProps = {
  pet: Pick<PetData, "id" | "name" | "species" | "breed" | "avatarUrl">
}

export function PetCard({ pet }: PetCardProps) {
  const subtitle = pet.breed?.trim() || SPECIES_LABELS[pet.species]

  return (
    <Link
      href={`/me/pets/${pet.id}`}
      className="group block rounded-xl border border-border bg-card transition-colors hover:border-primary/30 hover:bg-muted/30"
    >
      <div className="flex items-center gap-4 p-4">
        <Avatar size="lg" className="size-12">
          {pet.avatarUrl ? (
            <AvatarImage src={pet.avatarUrl} alt={pet.name} />
          ) : null}
          <AvatarFallback className="text-lg">
            {SPECIES_EMOJI[pet.species]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground group-hover:text-primary">
            {pet.name}
          </p>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <PawPrint className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  )
}

type PetListProps = {
  pets: PetData[]
}

export function PetList({ pets }: PetListProps) {
  if (pets.length === 0) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <PawPrint className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>Nenhum pet cadastrado</CardTitle>
          <CardDescription>
            Adicione seu primeiro pet para personalizar recomendações e
            solicitações.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          <Link
            href="/me/pets/new"
            className={buttonVariants({ className: "gap-2" })}
          >
            <Plus className="size-4" />
            Adicionar pet
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pets.map((pet) => (
        <PetCard key={pet.id} pet={pet} />
      ))}
    </div>
  )
}
