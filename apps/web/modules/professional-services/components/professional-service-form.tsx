"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, AlertCircle, Info, Wrench } from "lucide-react"
import { toast } from "sonner"

import {
  createProfessionalServiceAction,
  updateProfessionalServiceAction,
} from "../application/actions"
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types"
import type { ProfessionalServiceRow } from "../domain/types"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const NAVY = "#1D2F6F"

const formSchema = z
  .object({
    name: z
      .string()
      .min(2, "Nome do serviço deve ter ao menos 2 caracteres")
      .max(100, "Nome muito longo"),
    description: z
      .string()
      .max(500, "Descrição pode ter no máximo 500 caracteres")
      .optional(),
    serviceType: z.enum(SERVICE_TYPES, {
      error: () => "Selecione uma categoria",
    }),
    basePrice: z.union([z.literal(""), z.string()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.basePrice) return
    const price = parseFloat(data.basePrice)
    if (isNaN(price)) {
      ctx.addIssue({ code: "custom", path: ["basePrice"], message: "Valor inválido" })
    } else if (price <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["basePrice"],
        message: "Preço base deve ser positivo",
      })
    } else if (price > 10000) {
      ctx.addIssue({
        code: "custom",
        path: ["basePrice"],
        message: "Valor muito alto",
      })
    }
  })

type FormValues = z.infer<typeof formSchema>

type Props = {
  mode: "create" | "edit"
  service?: ProfessionalServiceRow
  onCancel: () => void
  onSuccess: () => void
}

export function ProfessionalServiceForm({
  mode,
  service,
  onCancel,
  onSuccess,
}: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const defaultBasePrice =
    service?.priceMin != null
      ? String(service.priceMin)
      : service?.priceMax != null
        ? String(service.priceMax)
        : ""

  const {
    register,
    handleSubmit,
    control,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      serviceType: service?.serviceType,
      basePrice: defaultBasePrice,
    },
  })

  const watchedType = watch("serviceType")

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const basePrice = values.basePrice ? parseFloat(values.basePrice) : undefined

    if (mode === "create") {
      const result = await createProfessionalServiceAction({
        name: values.name,
        description: values.description || undefined,
        serviceType: values.serviceType as ServiceType,
        basePrice,
      })

      if (!result.success) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            setError(field as keyof FormValues, { message: (messages as string[])[0] })
          }
        } else {
          setServerError(result.error)
        }
        return
      }

      toast.success("Serviço criado com sucesso.")
      router.refresh()
      onSuccess()
      return
    }

    if (!service) return

    const result = await updateProfessionalServiceAction(service.id, {
      name: values.name,
      description: values.description || undefined,
      serviceType: values.serviceType as ServiceType,
      basePrice,
    })

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof FormValues, { message: (messages as string[])[0] })
        }
      } else {
        setServerError(result.error)
      }
      return
    }

    toast.success("Serviço atualizado com sucesso.")
    router.refresh()
    onSuccess()
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-primary/10">
      <div className="mb-4 flex items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ background: `${NAVY}14`, color: NAVY }}
        >
          <Wrench className="size-4" />
        </span>
        <h2 className="text-sm font-bold text-foreground">
          {mode === "create"
            ? "Adicionar serviço"
            : `Editar · ${service?.name ?? "serviço"}`}
        </h2>
      </div>
      <div>
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

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Categoria *
            </div>
            <Controller
              name="serviceType"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SERVICE_TYPES.map((type) => {
                    const isSelected = field.value === type
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={isSubmitting}
                        aria-pressed={isSelected}
                        onClick={() => field.onChange(type)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all",
                          isSelected
                            ? "border-primary bg-primary/8 text-primary ring-2 ring-primary/25"
                            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/40",
                          "disabled:pointer-events-none disabled:opacity-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                            isSelected ? "border-primary bg-primary" : "border-border"
                          )}
                        >
                          {isSelected && (
                            <span className="size-1.5 rounded-full bg-primary-foreground" />
                          )}
                        </span>
                        <span className="line-clamp-2 leading-snug">
                          {SERVICE_TYPE_LABELS[type]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            />
            {errors.serviceType?.message ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.serviceType.message}
              </p>
            ) : null}
          </div>

          <FormField
            name="name"
            label="Nome *"
            error={errors.name?.message}
            description={
              watchedType
                ? `Ex: ${SERVICE_TYPE_LABELS[watchedType as ServiceType]} Premium`
                : undefined
            }
          >
            {(field) => (
              <Input
                {...field}
                {...register("name")}
                placeholder="Nome do serviço"
                disabled={isSubmitting}
              />
            )}
          </FormField>

          <FormField
            name="description"
            label="Descrição (opcional)"
            error={errors.description?.message}
          >
            {(field) => (
              <Textarea
                {...field}
                {...register("description")}
                placeholder="O que inclui este serviço?"
                rows={3}
                disabled={isSubmitting}
              />
            )}
          </FormField>

          <FormField
            name="basePrice"
            label="Preço base (R$)"
            error={errors.basePrice?.message}
            description="Opcional. Preços exatos podem ser combinados com o tutor."
          >
            {(field) => (
              <div className="relative max-w-xs">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  {...field}
                  {...register("basePrice")}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  className="pl-8"
                  disabled={isSubmitting}
                />
              </div>
            )}
          </FormField>

          <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>Tutores veem essa faixa. O valor exato vocês combinam na conversa.</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSubmitting} style={{ background: NAVY }}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Salvando…
                </>
              ) : mode === "create" ? (
                "Adicionar serviço"
              ) : (
                "Salvar alterações"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
