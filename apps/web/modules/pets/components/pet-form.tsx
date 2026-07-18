"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, AlertCircle, PawPrint, Check, Plus, ChevronLeft } from "lucide-react"

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
import { TutorStepBar } from "@/modules/tutor/components/tutor-step-bar"
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

// ── Onboarding: implementação própria (visual dedicado) ────────────────────
//
// Não reaproveita o JSX de PetForm acima — aquele componente também é usado
// em /me/pets/new e /me/pets/[id] (fora do onboarding) e deve continuar com
// o visual atual, intocado. OnboardingPetForm usa a mesma validação Zod,
// o mesmo createPetAction e a mesma regra de negócio (pet obrigatório, sem
// botão de pular), só que com o layout do redesign do onboarding de tutor.

const NAVY = "#1D2F6F"
const CORAL = "#E07A5F"
const GREEN = "#40916C"

const onboardingPetSchema = z.object({
  name: z.string().min(1, "Nome do pet é obrigatório").max(100, "Nome muito longo"),
  species: z.enum(SPECIES, { error: () => "Selecione uma espécie válida" }),
  breed: z.string().max(100, "Raça muito longa").optional(),
  avatarUrl: z.string().optional(),
})

type OnboardingPetFormValues = z.infer<typeof onboardingPetSchema>

type OnboardingPetFormProps = {
  /** Primeiro nome do tutor, usado na mensagem de sucesso. */
  firstName?: string
}

/**
 * Formulário de onboarding — pet é obrigatório para concluir o cadastro,
 * então não expõe a opção de pular. Ao concluir, mostra uma tela de sucesso
 * antes de seguir para o Discovery.
 */
export function OnboardingPetForm({ firstName = "" }: OnboardingPetFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showAvatarField, setShowAvatarField] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingPetFormValues>({
    resolver: zodResolver(onboardingPetSchema),
    defaultValues: { name: "", breed: "", avatarUrl: "" },
  })

  const petName = watch("name")

  async function onSubmit(values: OnboardingPetFormValues) {
    setServerError(null)

    const input: CreatePetInput = {
      name: values.name,
      species: values.species,
      breed: values.breed || undefined,
      avatarUrl: values.avatarUrl?.trim() || undefined,
      hasSpecialNeeds: false,
    }

    const result = await createPetAction(input)

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof OnboardingPetFormValues, { message: messages[0] })
        }
      } else {
        setServerError(result.error)
      }
      return
    }

    // Sucesso — mostra a tela de conclusão antes de ir para o Discovery.
    setJustCompleted(true)
  }

  // Tela de sucesso — seção própria (raio/sombra diferentes da etapa de
  // formulário), sem header/voltar/step-bar da etapa anterior.
  if (justCompleted) {
    return (
      <section className="rounded-[32px] border border-black/[.08] bg-white p-9 text-center shadow-[0_20px_40px_-22px_rgba(29,47,111,.25)]">
        <span
          className="mb-4 inline-grid size-16 place-items-center rounded-[20px] bg-[#E7F1EC]"
          style={{ color: GREEN }}
        >
          <Check className="size-[30px]" strokeWidth={2.4} />
        </span>
        <h2 className="mb-2 text-[19px] font-extrabold text-[#1A1A1A]">
          Prontinho{firstName ? `, ${firstName}` : ""}!
        </h2>
        <p className="mx-auto mb-5 max-w-[26ch] text-[13px] leading-relaxed text-[#6B6B63]">
          {petName || "Seu pet"} já está no seu perfil. Vamos encontrar quem
          cuida dele com confiança?
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/discover")
            router.refresh()
          }}
          className="w-full rounded-[14px] py-[15px] text-[14.5px] font-bold text-white transition active:scale-[.99]"
          style={{ background: NAVY }}
        >
          Encontrar profissional
        </button>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[44px] border border-black/5 bg-[#FAFAF8] shadow-[0_30px_60px_-24px_rgba(29,47,111,.30)]">
      <header className="bg-white px-6 pb-4 pt-5">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/onboarding/tutor" aria-label="Voltar" className="text-[#1A1A1A]">
            <ChevronLeft className="size-5" />
          </Link>
          <TutorStepBar total={2} current={2} />
          <span className="text-xs font-bold text-[#8A897F]">2/2</span>
        </div>
        <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#1A1A1A]">
          Quem é seu melhor amigo?
        </h1>
        <p className="text-[12.5px] text-[#8A897F]">
          Vamos conhecer seu pet. É necessário cadastrar ao menos um para continuar.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="px-6 pb-6 pt-5">
        {serverError ? (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-lg border border-[#E07A5F]/30 bg-[#E07A5F]/5 px-3 py-2.5 text-sm text-[#C15A3F]"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        {/* Foto — decorativa, revela o campo real de URL ao clicar (sem upload de arquivo disponível) */}
        <div className="mb-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAvatarField((v) => !v)}
            className="relative grid size-[88px] place-items-center rounded-[28px]"
            style={{ background: "#FBEDE8", color: CORAL }}
            aria-label="Adicionar foto do pet"
            aria-pressed={showAvatarField}
          >
            <PawPrint className="size-11" />
            <span
              className="absolute -bottom-1 -right-1 grid size-[30px] place-items-center rounded-full border-[3px] border-[#FAFAF8]"
              style={{ background: NAVY }}
            >
              <Plus className="size-[15px] text-white" />
            </span>
          </button>
        </div>

        {showAvatarField && (
          <>
            <Field label="Link da foto (opcional)" error={errors.avatarUrl?.message}>
              <input
                {...register("avatarUrl")}
                type="url"
                placeholder="https://..."
                disabled={isSubmitting}
                className="w-full rounded-[14px] border-[1.5px] border-black/10 bg-white px-4 py-3.5 text-[14.5px] font-medium outline-none transition focus:border-[#2C4893] focus:shadow-[0_0_0_4px_rgba(44,72,147,.10)] disabled:opacity-60"
              />
            </Field>
            <div className="h-[18px]" />
          </>
        )}

        <Field label="Nome do pet *" error={errors.name?.message}>
          <input
            {...register("name")}
            placeholder="Nome do pet"
            autoFocus
            disabled={isSubmitting}
            className="w-full rounded-[14px] border-[1.5px] border-black/10 bg-white px-4 py-3.5 text-[14.5px] font-medium outline-none transition focus:border-[#2C4893] focus:shadow-[0_0_0_4px_rgba(44,72,147,.10)] disabled:opacity-60"
          />
        </Field>

        <div className="h-[18px]" />

        <p className="mb-2 text-xs font-bold text-[#1A1A1A]">Espécie *</p>
        <Controller
          name="species"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2.5">
              {SPECIES.map((s) => {
                const active = field.value === s
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => field.onChange(s)}
                    aria-pressed={active}
                    className={cn(
                      "flex-1 basis-[30%] rounded-[13px] px-3 py-3 text-[13px] font-bold transition disabled:pointer-events-none disabled:opacity-50",
                      active
                        ? "text-white"
                        : "border-[1.5px] border-black/10 bg-white font-semibold text-[#57564E]"
                    )}
                    style={active ? { background: NAVY } : undefined}
                  >
                    {SPECIES_EMOJI[s]} {SPECIES_LABELS[s]}
                  </button>
                )
              })}
            </div>
          )}
        />
        {errors.species?.message ? (
          <p className="mt-1.5 text-[12px] font-medium text-[#C15A3F]">
            {errors.species.message}
          </p>
        ) : null}

        <div className="h-[18px]" />

        <Field label="Raça (opcional)" error={errors.breed?.message}>
          <input
            {...register("breed")}
            placeholder="Ex: SRD, Golden Retriever"
            disabled={isSubmitting}
            className="w-full rounded-[14px] border-[1.5px] border-black/10 bg-white px-4 py-3.5 text-[14.5px] font-medium outline-none transition focus:border-[#2C4893] focus:shadow-[0_0_0_4px_rgba(44,72,147,.10)] disabled:opacity-60"
          />
        </Field>
      </div>

      <footer className="border-t border-black/[.07] bg-white px-6 pb-6 pt-3.5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-[14px] py-[15px] text-[14.5px] font-bold text-white transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: NAVY }}
        >
          {isSubmitting ? "Salvando…" : "Concluir"}
        </button>
      </footer>
      </form>
    </section>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[#1A1A1A]">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#C15A3F]">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </span>
      ) : null}
    </label>
  )
}

export type { Species }
