"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, AlertCircle, MapPin, User } from "lucide-react"
import { toast } from "sonner"

import { updateTutorProfileAction } from "@/modules/tutor/application/actions"
import {
  UpdateTutorProfileSchema,
  type TutorProfileData,
  type UpdateTutorProfileInput,
} from "@/modules/tutor/domain/types"
import { KNOWN_LOCATIONS, findKnownCityState } from "@/modules/location"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type TutorProfileEditFormProps = {
  profile: TutorProfileData
}

export function TutorProfileEditForm({ profile }: TutorProfileEditFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpdateTutorProfileInput>({
    resolver: zodResolver(UpdateTutorProfileSchema),
    defaultValues: {
      displayName: profile.displayName,
      city: profile.city,
      state: profile.state,
      neighborhood: profile.neighborhood ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
    },
  })

  async function onSubmit(values: UpdateTutorProfileInput) {
    setServerError(null)

    const result = await updateTutorProfileAction(profile.id, values)

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof UpdateTutorProfileInput, {
            message: messages[0],
          })
        }
      } else {
        setServerError(result.error)
      }
      return
    }

    toast.success("Perfil atualizado.")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      ) : null}

      <SectionLabel icon={<User className="size-3.5" />} label="Identificação" />

      <FormField
        name="displayName"
        label="Nome *"
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

      <FormField name="phone" label="Telefone" error={errors.phone?.message}>
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

      <FormField name="bio" label="Bio (opcional)" error={errors.bio?.message}>
        {(field) => (
          <Textarea
            {...field}
            {...register("bio")}
            rows={3}
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

      <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Salvando...
          </>
        ) : (
          "Salvar alterações"
        )}
      </Button>
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
