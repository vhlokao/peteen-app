"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, AlertCircle, MapPin, Building2, Phone, FileText } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { updatePartnerPortalProfileAction } from "@/modules/partner-portal/application/actions"
import { UpdatePartnerPortalProfileSchema } from "@/modules/partner-portal/domain/schemas"
import type { PartnerPortalProfile } from "@/modules/partner-portal/domain/types"
import {
  PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABELS,
} from "@/modules/partners/domain/constants"
import type { PartnerCategory } from "@/modules/partners/domain/types"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type PartnerProfileEditFormProps = {
  partner: PartnerPortalProfile
}

type PartnerProfileEditValues = z.infer<typeof UpdatePartnerPortalProfileSchema>

export function PartnerProfileEditForm({ partner }: PartnerProfileEditFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PartnerProfileEditValues>({
    resolver: zodResolver(UpdatePartnerPortalProfileSchema),
    defaultValues: {
      businessName: partner.businessName,
      description: partner.description ?? "",
      city: partner.city,
      state: partner.state,
      phone: partner.phone ?? "",
      category: partner.category,
      website: partner.website ?? "",
      logoUrl: partner.logoUrl ?? "",
    },
  })

  async function onSubmit(values: PartnerProfileEditValues) {
    setServerError(null)

    const result = await updatePartnerPortalProfileAction(partner.id, {
      ...values,
      state: values.state.toUpperCase(),
      category: values.category as PartnerCategory,
    })

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof PartnerProfileEditValues, {
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

      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Building2 className="size-3.5" />
        Identidade
      </div>

      <FormField
        name="businessName"
        label="Nome da organização *"
        error={errors.businessName?.message}
      >
        {(field) => (
          <Input id={field.id} {...register("businessName")} aria-invalid={field["aria-invalid"]} />
        )}
      </FormField>

      <FormField
        name="category"
        label="Categoria *"
        error={errors.category?.message}
      >
        {(field) => (
          <select
            id={field.id}
            {...register("category")}
            aria-invalid={field["aria-invalid"]}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            {PARTNER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {PARTNER_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField name="logoUrl" label="URL do logo" error={errors.logoUrl?.message}>
        {(field) => (
          <Input
            id={field.id}
            {...register("logoUrl")}
            type="url"
            placeholder="https://"
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>

      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <FileText className="size-3.5" />
        Sobre
      </div>

      <FormField
        name="description"
        label="Descrição"
        error={errors.description?.message}
      >
        {(field) => (
          <Textarea
            id={field.id}
            {...register("description")}
            aria-invalid={field["aria-invalid"]}
            rows={4}
            placeholder="Conte sobre sua organização e como apoia tutores e profissionais."
          />
        )}
      </FormField>

      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Phone className="size-3.5" />
        Contato
      </div>

      <FormField name="phone" label="Telefone" error={errors.phone?.message}>
        {(field) => (
          <Input id={field.id} {...register("phone")} type="tel" aria-invalid={field["aria-invalid"]} />
        )}
      </FormField>

      <FormField name="website" label="Website" error={errors.website?.message}>
        {(field) => (
          <Input
            id={field.id}
            {...register("website")}
            type="url"
            placeholder="https://"
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>

      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <MapPin className="size-3.5" />
        Localização
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_5rem]">
        <FormField name="city" label="Cidade *" error={errors.city?.message}>
          {(field) => (
            <Input id={field.id} {...register("city")} aria-invalid={field["aria-invalid"]} />
          )}
        </FormField>
        <FormField name="state" label="UF *" error={errors.state?.message}>
          {(field) => (
            <Input
              id={field.id}
              {...register("state")}
              maxLength={2}
              className="uppercase"
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Salvando…
          </>
        ) : (
          "Salvar alterações"
        )}
      </Button>
    </form>
  )
}
