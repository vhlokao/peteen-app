"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { CalendarDays, Loader2 } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createServiceRequestAction } from "@/modules/service-request/application/actions"
import { SPECIES_LABELS, type PetData } from "@/modules/tutor/domain/types"
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
  type ProfessionalPublicProfile,
} from "@/modules/professional/domain/types"
import { formatPublicServicePriceCompact } from "@/modules/professional/domain/format-service-price"

// ─────────────────────────────────────────────────────────────────────────────
// Schema local — usa tipos de input compatíveis com HTML forms
// ─────────────────────────────────────────────────────────────────────────────

const requestFormSchema = z.object({
  petId: z.string().min(1, "Selecione um pet"),
  serviceId: z.string().min(1, "Selecione um serviço"),
  scheduledAt: z
    .string()
    .min(1, "Informe a data")
    .refine((d) => {
      const date = new Date(d)
      return !isNaN(date.getTime()) && date > new Date()
    }, "A data deve ser no futuro"),
  notes: z.string().max(500, "Máximo 500 caracteres").optional(),
})

type RequestFormValues = z.infer<typeof requestFormSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type RequestServiceSheetProps = {
  professional: Pick<
    ProfessionalPublicProfile,
    "id" | "displayName" | "services"
  >
  pets: PetData[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Styled native select helper
// ─────────────────────────────────────────────────────────────────────────────

function NativeSelect({
  id,
  className,
  error,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id?: string
  error?: string
}) {
  return (
    <div>
      <div className="relative">
        <select
          id={id}
          className={cn(
            "h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-xs",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus:ring-destructive",
            className
          )}
          {...props}
        />
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function RequestServiceSheet({
  professional,
  pets,
}: RequestServiceSheetProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const activeServices = professional.services.filter((s) => {
    // ProfessionalPublicProfile.services já filtra por isActive no repositório
    return true
  })

  const todayStr = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      petId: "",
      serviceId: "",
      scheduledAt: "",
      notes: "",
    },
  })

  function onSubmit(values: RequestFormValues) {
    const selectedService = professional.services.find(
      (s) => s.id === values.serviceId
    )
    if (!selectedService) {
      toast.error("Serviço inválido. Tente novamente.")
      return
    }

    startTransition(async () => {
      const result = await createServiceRequestAction({
        professionalId: professional.id,
        petId: values.petId,
        serviceType: selectedService.serviceType as ServiceType,
        scheduledAt: new Date(values.scheduledAt),
        notes: values.notes || undefined,
        isRecurring: false,
      })

      if (!result.success) {
        toast.error(result.error ?? "Erro ao enviar solicitação.")
        return
      }

      toast.success("Solicitação enviada!", {
        description: "O profissional receberá seu pedido em breve.",
      })
      setOpen(false)
      reset()
      router.push("/requests")
    })
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        onClick={() => setOpen(true)}
        disabled={pets.length === 0}
      >
        {pets.length === 0
          ? "Cadastre um pet para solicitar"
          : "Solicitar atendimento"}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:max-h-[80dvh]">
          <SheetHeader className="pb-2">
            <SheetTitle>Solicitar atendimento</SheetTitle>
            <SheetDescription>
              Sua solicitação será enviada para{" "}
              <strong>{professional.displayName}</strong>. O profissional
              entrará em contato para confirmar.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 px-4 pb-2">
            {/* Pet */}
            <div className="space-y-1.5">
              <Label htmlFor="petId">Qual pet?</Label>
              <NativeSelect
                id="petId"
                error={errors.petId?.message}
                {...register("petId")}
              >
                <option value="">Selecione um pet…</option>
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} ({SPECIES_LABELS[pet.species]})
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* Serviço */}
            <div className="space-y-1.5">
              <Label htmlFor="serviceId">Tipo de serviço</Label>
              <NativeSelect
                id="serviceId"
                error={errors.serviceId?.message}
                {...register("serviceId")}
              >
                <option value="">Selecione um serviço…</option>
                {activeServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} — {SERVICE_TYPE_LABELS[service.serviceType as ServiceType]}
                    {formatPublicServicePriceCompact(service)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* Data desejada */}
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt" className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                Data desejada
              </Label>
              <input
                id="scheduledAt"
                type="date"
                min={todayStr}
                className={cn(
                  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs",
                  "focus:outline-none focus:ring-1 focus:ring-ring",
                  errors.scheduledAt && "border-destructive focus:ring-destructive"
                )}
                {...register("scheduledAt")}
              />
              {errors.scheduledAt && (
                <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">
                Observações{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Informe necessidades especiais, horário preferido, etc."
                rows={3}
                {...register("notes")}
              />
              {errors.notes && (
                <p className="text-xs text-destructive">{errors.notes.message}</p>
              )}
            </div>

            <SheetFooter className="px-0 pt-2">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isPending ? "Enviando…" : "Confirmar solicitação"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
