"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, AlertCircle, PawPrint } from "lucide-react"

import {
  createPetAction,
  updatePetAction,
} from "@/modules/pets/application/actions"
import {
  SPECIES,
  SPECIES_LABELS,
  SPECIES_EMOJI,
  PET_GENDERS,
  PET_GENDER_LABELS,
  PET_SIZES,
  PET_SIZE_LABELS,
  type CreatePetInput,
  type PetData,
  type Species,
  type PetGender,
  type PetSize,
} from "@/modules/pets/domain/types"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const petFormSchema = z.object({
  name: z
    .string()
    .min(1, "Nome do pet é obrigatório")
    .max(100, "Nome muito longo"),
  species: z.enum(SPECIES, { error: () => "Selecione uma espécie válida" }),
  breed: z.string().max(100, "Raça muito longa").optional(),
  gender: z.enum(PET_GENDERS).optional(),
  birthDate: z.string().optional(),
  weight: z
    .number()
    .positive("Peso deve ser positivo")
    .max(200, "Peso inválido")
    .optional(),
  size: z.enum(PET_SIZES).optional(),
  description: z.string().max(1000, "Descrição muito longa").optional(),
  avatarUrl: z.string().optional(),
})

type PetFormValues = z.infer<typeof petFormSchema>

type PetFormProps = {
  mode?: "create" | "edit"
  pet?: PetData
  redirectTo?: string
  skipTo?: string
  showSkip?: boolean
  submitLabel?: string
}

function toFormValues(pet?: PetData): Partial<PetFormValues> {
  if (!pet) {
    return {
      name: "",
      breed: "",
      birthDate: "",
      description: "",
      avatarUrl: "",
    }
  }

  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? "",
    gender: pet.gender ?? undefined,
    birthDate: pet.birthDate
      ? pet.birthDate.toISOString().split("T")[0]
      : "",
    weight: pet.weight ?? undefined,
    size: pet.size ?? undefined,
    description: pet.description ?? pet.notes ?? "",
    avatarUrl: pet.avatarUrl ?? "",
  }
}

function toPetInput(values: PetFormValues): CreatePetInput {
  return {
    name: values.name,
    species: values.species,
    breed: values.breed || undefined,
    gender: values.gender,
    birthDate: values.birthDate ? new Date(values.birthDate) : undefined,
    weight: values.weight,
    size: values.size,
    description: values.description || undefined,
    avatarUrl: values.avatarUrl?.trim() || undefined,
    hasSpecialNeeds: false,
  }
}

export function PetForm({
  mode = "create",
  pet,
  redirectTo = "/me/pets",
  skipTo = "/discover",
  showSkip = mode === "create" && !pet,
  submitLabel,
}: PetFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PetFormValues>({
    resolver: zodResolver(petFormSchema),
    defaultValues: toFormValues(pet),
  })

  const selectedSpecies = watch("species")

  async function onSubmit(values: PetFormValues) {
    setServerError(null)
    const input = toPetInput(values)

    const result =
      mode === "edit" && pet
        ? await updatePetAction(pet.id, input)
        : await createPetAction(input)

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof PetFormValues, { message: messages[0] })
        }
      } else {
        setServerError(result.error)
      }
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  const defaultSubmitLabel =
    mode === "edit" ? "Salvar alterações" : "Adicionar pet"

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {serverError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      ) : null}

      <FormField name="name" label="Nome *" error={errors.name?.message}>
        {(field) => (
          <Input
            {...field}
            {...register("name")}
            placeholder="Como seu pet se chama?"
            autoFocus
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Espécie *</label>
        <Controller
          name="species"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SPECIES.map((species) => (
                <button
                  key={species}
                  type="button"
                  onClick={() => field.onChange(species)}
                  disabled={isSubmitting}
                  aria-pressed={field.value === species}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-all",
                    "text-[0.65rem] font-medium leading-tight",
                    field.value === species
                      ? "border-primary bg-primary/8 text-primary ring-2 ring-primary/30"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50",
                    "disabled:pointer-events-none disabled:opacity-50"
                  )}
                >
                  <span className="text-xl leading-none">
                    {SPECIES_EMOJI[species]}
                  </span>
                  <span className="line-clamp-1">{SPECIES_LABELS[species]}</span>
                </button>
              ))}
            </div>
          )}
        />
        {errors.species?.message ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.species.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField name="breed" label="Raça" error={errors.breed?.message}>
          {(field) => (
            <Input
              {...field}
              {...register("breed")}
              placeholder={
                selectedSpecies === "DOG"
                  ? "Ex: Golden Retriever, SRD"
                  : selectedSpecies === "CAT"
                    ? "Ex: Persa, SRD"
                    : "Raça ou origem"
              }
              disabled={isSubmitting}
            />
          )}
        </FormField>

        <FormField name="gender" label="Sexo" error={errors.gender?.message}>
          {(field) => (
            <select
              id={field.id}
              {...register("gender")}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione</option>
              {PET_GENDERS.map((g) => (
                <option key={g} value={g}>
                  {PET_GENDER_LABELS[g as PetGender]}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          name="birthDate"
          label="Nascimento"
          error={errors.birthDate?.message}
        >
          {(field) => (
            <Input
              {...field}
              {...register("birthDate")}
              type="date"
              max={new Date().toISOString().split("T")[0]}
              disabled={isSubmitting}
            />
          )}
        </FormField>

        <FormField name="size" label="Porte" error={errors.size?.message}>
          {(field) => (
            <select
              id={field.id}
              {...register("size")}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione</option>
              {PET_SIZES.map((s) => (
                <option key={s} value={s}>
                  {PET_SIZE_LABELS[s as PetSize]}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>

      <FormField
        name="weight"
        label="Peso (kg)"
        error={errors.weight?.message}
        description="Útil para banho, tosa e contexto de serviços."
      >
        {(field) => (
          <Input
            {...field}
            {...register("weight", {
              setValueAs: (v: string) => {
                const n = parseFloat(v)
                return isNaN(n) ? undefined : n
              },
            })}
            type="number"
            step="0.1"
            min="0.1"
            max="200"
            placeholder="Ex: 12.5"
            disabled={isSubmitting}
            className="max-w-[160px]"
          />
        )}
      </FormField>

      <FormField
        name="description"
        label="Descrição"
        error={errors.description?.message}
        description="Temperamento, alergias, rotinas — qualquer detalhe útil."
      >
        {(field) => (
          <Textarea
            {...field}
            {...register("description")}
            placeholder="Ex: Brincalhão, medo de barulho, come ração X..."
            rows={3}
            disabled={isSubmitting}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>

      <FormField
        name="avatarUrl"
        label="Foto (URL)"
        error={errors.avatarUrl?.message}
        description="Cole o link de uma imagem do seu pet."
      >
        {(field) => (
          <Input
            {...field}
            {...register("avatarUrl")}
            type="url"
            placeholder="https://..."
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-3 pt-2">
        <Button
          type="submit"
          className="w-full gap-2"
          disabled={isSubmitting}
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <PawPrint className="size-4" />
              {submitLabel ?? defaultSubmitLabel}
            </>
          )}
        </Button>

        {showSkip ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(skipTo)}
            disabled={isSubmitting}
            className="w-full text-muted-foreground"
          >
            Pular por agora — adicionarei depois
          </Button>
        ) : null}
      </div>
    </form>
  )
}

/**
 * Formulário de onboarding — pet é obrigatório para concluir o cadastro,
 * então não expõe a opção de pular.
 */
export function OnboardingPetForm() {
  return (
    <PetForm
      redirectTo="/discover"
      showSkip={false}
      submitLabel="Adicionar pet e continuar"
    />
  )
}

export type { Species }
