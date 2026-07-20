"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, AlertCircle, MapPin, User, Briefcase, Phone, Pencil, X } from "lucide-react"
import { toast } from "sonner"

import { updateProfessionalProfileAction } from "@/modules/professional/application/actions"
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type UpdateProfessionalProfileInput,
  type ProfessionalProfileData,
  type ServiceType,
} from "@/modules/professional/domain/types"
import { KNOWN_LOCATIONS, findKnownCityState } from "@/modules/location"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const NAVY = "#1D2F6F"

type ProfessionalProfileEditFormProps = {
  profile: ProfessionalProfileData
}

const professionalProfileEditSchema = z.object({
  displayName: z
    .string()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(100, "Nome muito longo"),
  bio: z.string().max(1000, "Bio pode ter no máximo 1000 caracteres").optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]+$/, "Informe seu WhatsApp para receber solicitações")
    .refine((val) => val.replace(/\D/g, "").length >= 10, {
      message: "Informe seu WhatsApp para receber solicitações",
    }),
  neighborhood: z.string().max(100).optional(),
  city: z.string().min(2, "Cidade é obrigatória").max(100),
  state: z.string().length(2, "Use a sigla do estado (ex: SP)"),
  serviceTypes: z
    .array(z.enum(SERVICE_TYPES))
    .min(1, "Selecione ao menos um tipo de serviço"),
  specializations: z.array(z.string().max(50)).max(20),
})

type ProfessionalProfileEditValues = z.infer<typeof professionalProfileEditSchema>

export function ProfessionalProfileEditForm({
  profile,
}: ProfessionalProfileEditFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfessionalProfileEditValues>({
    resolver: zodResolver(professionalProfileEditSchema),
    defaultValues: {
      displayName: profile.displayName,
      bio: profile.bio ?? "",
      phone: profile.phone ?? "",
      neighborhood: profile.neighborhood ?? "",
      city: profile.city,
      state: profile.state,
      serviceTypes: profile.serviceTypes,
      specializations: profile.specializations,
    },
  })

  async function onSubmit(values: ProfessionalProfileEditValues) {
    setServerError(null)

    const input: UpdateProfessionalProfileInput = {
      ...values,
      state: values.state.toUpperCase(),
      specializations: values.specializations,
    }

    const result = await updateProfessionalProfileAction(profile.id, input)

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ProfessionalProfileEditValues, {
            message: messages[0],
          })
        }
      } else {
        setServerError(result.error)
      }
      return
    }

    toast.success("Perfil atualizado com sucesso.")
    router.refresh()
    setEditing(false)
  }

  function handleCancel() {
    reset()
    setServerError(null)
    setEditing(false)
  }

  const bioLength = (watch("bio") ?? "").length
  // Gate do botão Salvar — mesma regra de validade do schema Zod (>= 10 dígitos).
  const isPhoneValid = (watch("phone") ?? "").replace(/\D/g, "").length >= 10

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
          <p>
            <span className="text-muted-foreground">Nome: </span>
            <span className="font-medium text-foreground">{profile.displayName}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Telefone: </span>
            <span className="font-medium text-foreground">{profile.phone || "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Local: </span>
            <span className="font-medium text-foreground">
              {profile.city}/{profile.state}
            </span>
          </p>
          <p className="text-muted-foreground">
            {profile.bio
              ? profile.bio.length > 140
                ? `${profile.bio.slice(0, 140)}…`
                : profile.bio
              : "Nenhuma bio adicionada."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </div>
    )
  }

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

      <SectionLabel icon={<User className="size-3.5" />} label="Identidade" />

      <FormField
        name="displayName"
        label="Nome de exibição *"
        error={errors.displayName?.message}
      >
        {(field) => (
          <Input
            {...field}
            {...register("displayName")}
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <SectionLabel icon={<User className="size-3.5" />} label="Sobre você" />

      <FormField name="bio" label="Bio (opcional)" error={errors.bio?.message}>
        {(field) => (
          <div className="space-y-1">
            <Textarea
              {...field}
              {...register("bio")}
              rows={4}
              disabled={isSubmitting}
              className="focus-visible:border-[#1D2F6F] focus-visible:ring-[#1D2F6F]/20"
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {bioLength}/1000 caracteres
            </p>
          </div>
        )}
      </FormField>

      <SectionLabel icon={<Phone className="size-3.5" />} label="Contato" />

      <FormField
        name="phone"
        label="WhatsApp *"
        error={errors.phone?.message}
      >
        {(field) => (
          <Input
            {...field}
            {...register("phone")}
            type="tel"
            placeholder="+55 11 9 9999-9999"
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <SectionLabel icon={<MapPin className="size-3.5" />} label="Localização" />

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <FormField name="city" label="Cidade *" error={errors.city?.message}>
          {(field) => (
            <Controller
              name="city"
              control={control}
              render={({ field: cityField }) => (
                <select
                  id={field.id}
                  value={cityField.value}
                  onChange={(e) => {
                    const city = e.target.value
                    cityField.onChange(city)
                    // UF derivada da cidade — mantém city e state consistentes.
                    setValue("state", findKnownCityState(city) ?? "", {
                      shouldValidate: true,
                    })
                  }}
                  onBlur={cityField.onBlur}
                  disabled={isSubmitting}
                  aria-invalid={field["aria-invalid"]}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecione a cidade</option>
                  {KNOWN_LOCATIONS.map((loc) => (
                    <option key={loc.city} value={loc.city}>
                      {loc.city} — {loc.state}
                    </option>
                  ))}
                </select>
              )}
            />
          )}
        </FormField>

        <FormField
          name="state"
          label="UF"
          error={errors.state?.message}
          className="w-20"
        >
          {(field) => (
            <Input
              {...field}
              value={watch("state")}
              readOnly
              tabIndex={-1}
              placeholder="—"
              aria-label="Estado (preenchido pela cidade)"
              className="cursor-default bg-muted/40 text-center uppercase text-muted-foreground"
            />
          )}
        </FormField>
      </div>

      <FormField
        name="neighborhood"
        label="Bairro (opcional)"
        error={errors.neighborhood?.message}
      >
        {(field) => (
          <Input
            {...field}
            {...register("neighborhood")}
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <div className="space-y-3">
        <SectionLabel icon={<Briefcase className="size-3.5" />} label="Especialidades" />
        <p className="text-xs text-muted-foreground">Tipos de serviço *</p>
        <Controller
          name="serviceTypes"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SERVICE_TYPES.map((type) => {
                const isSelected = field.value.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isSubmitting}
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (isSelected) {
                        field.onChange(
                          field.value.filter((t: ServiceType) => t !== type)
                        )
                      } else {
                        field.onChange([...field.value, type])
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all",
                      isSelected
                        ? "border-primary bg-primary/8 text-primary ring-2 ring-primary/25"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/40",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                  >
                    {SERVICE_TYPE_LABELS[type]}
                  </button>
                )
              })}
            </div>
          )}
        />
        {errors.serviceTypes?.message ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.serviceTypes.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Especializações (opcional)
        </label>
        <Controller
          name="specializations"
          control={control}
          render={({ field }) => (
            <TagInput
              value={field.value ?? []}
              onChange={field.onChange}
              placeholder="Digite e pressione Enter..."
              disabled={isSubmitting}
            />
          )}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="flex-1 gap-2"
          style={{ background: NAVY }}
          disabled={isSubmitting || !isPhoneValid}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </form>
  )
}

function SectionLabel({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {icon}
      {label}
    </div>
  )
}

function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [input, setInput] = useState("")

  function addTag(raw: string) {
    const tag = raw.trim()
    if (tag && !value.includes(tag) && tag.length <= 50 && value.length < 20) {
      onChange([...value, tag])
    }
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-input bg-transparent p-2",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remover ${tag}`}
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}
      {value.length < 20 && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) addTag(input)
          }}
          placeholder={value.length === 0 ? placeholder : "Adicionar..."}
          disabled={disabled}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
        />
      )}
    </div>
  )
}
