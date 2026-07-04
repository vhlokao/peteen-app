"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ChevronLeft, Loader2 } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { createServiceRequestAction } from "@/modules/service-request/application/actions"
import { parseCivilDateToStableInstant } from "@/lib/date/parse-civil-date"
import type { PetData } from "@/modules/tutor/domain/types"
import {
  type ServiceType,
  type ProfessionalPublicProfile,
} from "@/modules/professional/domain/types"
import { RequestFlowProgress } from "./RequestFlowProgress"
import { RequestPetStep } from "./RequestPetStep"
import { RequestServiceStep } from "./RequestServiceStep"
import { RequestScheduleStep } from "./RequestScheduleStep"
import { RequestReviewStep } from "./RequestReviewStep"
import { RequestSuccessState } from "./RequestSuccessState"

// ─────────────────────────────────────────────────────────────────────────────
// Schema — idêntico ao original. Nenhum campo, regra ou mensagem mudou.
// ─────────────────────────────────────────────────────────────────────────────

const requestFormSchema = z.object({
  petId: z.string().min(1, "Selecione um pet"),
  serviceId: z.string().min(1, "Selecione um serviço"),
  scheduledAt: z
    .string()
    .min(1, "Informe a data")
    .refine((d) => {
      // Mesma conversão usada na submissão (ver onSubmit) — meio-dia UTC evita
      // que a comparação de "data futura" seja afetada pelo deslocamento de
      // fuso que `new Date("YYYY-MM-DD")` (meia-noite UTC) introduziria.
      const date = parseCivilDateToStableInstant(d)
      return !isNaN(date.getTime()) && date > new Date()
    }, "A data deve ser no futuro"),
  notes: z.string().max(500, "Máximo 500 caracteres").optional(),
})

export type RequestFormValues = z.infer<typeof requestFormSchema>

type RequestServiceSheetProps = {
  professional: Pick<ProfessionalPublicProfile, "id" | "displayName" | "services">
  pets: PetData[]
}

const STEP_PET = 0
const STEP_SERVICE = 1
const STEP_SCHEDULE = 2
const STEP_REVIEW = 3
const STEP_SUCCESS = 4

const STEP_FIELDS: Record<number, (keyof RequestFormValues)[]> = {
  [STEP_PET]: ["petId"],
  [STEP_SERVICE]: ["serviceId"],
  [STEP_SCHEDULE]: ["scheduledAt", "notes"],
}

/**
 * RequestServiceSheet — fluxo guiado de solicitação (UX 3.6).
 *
 * Continua sendo UM formulário react-hook-form só (mesmo schema, mesmos
 * campos, mesma validação) — "etapas" são só visibilidade condicional do
 * mesmo form, então nenhum valor se perde ao navegar entre elas. O submit
 * real (chamada da Server Action) só é disparado a partir da etapa de
 * Revisão — nunca antes.
 *
 * Server Action, payload e contrato: idênticos ao componente anterior.
 */
export function RequestServiceSheet({ professional, pets }: RequestServiceSheetProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(STEP_PET)
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)

  const todayStr = new Date().toISOString().split("T")[0]!

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      petId: pets.length === 1 ? pets[0]!.id : "",
      serviceId: "",
      scheduledAt: "",
      notes: "",
    },
  })

  const values = watch()
  const selectedPet = pets.find((p) => p.id === values.petId)
  const selectedService = professional.services.find((s) => s.id === values.serviceId)

  // Foco avança para o título da etapa a cada mudança — leitura de tela e
  // teclado seguem o fluxo em vez de ficarem presos na etapa anterior.
  useEffect(() => {
    stepHeadingRef.current?.focus()
  }, [step])

  function resetFlow() {
    setStep(STEP_PET)
    setSubmitError(null)
    submittingRef.current = false
    reset({
      petId: pets.length === 1 ? pets[0]!.id : "",
      serviceId: "",
      scheduledAt: "",
      notes: "",
    })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetFlow()
  }

  async function goNext() {
    const fields = STEP_FIELDS[step]
    if (fields) {
      const valid = await trigger(fields)
      if (!valid) return
    }
    setStep((s) => Math.min(s + 1, STEP_REVIEW))
  }

  function goBack() {
    setSubmitError(null)
    setStep((s) => Math.max(s - 1, STEP_PET))
  }

  // Mesma lógica de submissão do componente anterior — payload idêntico.
  function onSubmit(values: RequestFormValues) {
    if (submittingRef.current) return // guarda contra duplo envio

    const selectedService = professional.services.find((s) => s.id === values.serviceId)
    if (!selectedService) {
      toast.error("Serviço inválido. Tente novamente.")
      return
    }

    submittingRef.current = true
    setSubmitError(null)

    startTransition(async () => {
      const result = await createServiceRequestAction({
        professionalId: professional.id,
        petId: values.petId,
        serviceType: selectedService.serviceType as ServiceType,
        scheduledAt: parseCivilDateToStableInstant(values.scheduledAt),
        notes: values.notes || undefined,
        isRecurring: false,
      })

      if (!result.success) {
        const message = result.error ?? "Erro ao enviar solicitação."
        toast.error(message)
        setSubmitError(message)
        submittingRef.current = false
        return
      }

      setStep(STEP_SUCCESS)
    })
  }

  const isReview = step === STEP_REVIEW
  const isSuccess = step === STEP_SUCCESS

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        onClick={() => setOpen(true)}
        disabled={pets.length === 0}
      >
        {pets.length === 0 ? "Cadastre um pet para solicitar" : "Solicitar atendimento"}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl p-0 sm:max-h-[85dvh] sm:max-w-lg"
        >
          {!isSuccess && (
            <>
              <SheetHeader className="shrink-0 gap-2 pb-1">
                {step > STEP_PET && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="size-3.5" />
                    Voltar
                  </button>
                )}
                <SheetTitle
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-lg outline-none"
                >
                  {step === STEP_PET && "Quem vai receber o cuidado?"}
                  {step === STEP_SERVICE && "Qual cuidado você precisa?"}
                  {step === STEP_SCHEDULE && "Quando você precisa?"}
                  {step === STEP_REVIEW && "Revise sua solicitação"}
                </SheetTitle>
                <SheetDescription>
                  {step === STEP_PET && "Escolha o pet para este atendimento."}
                  {step === STEP_SERVICE && `Serviços oferecidos por ${professional.displayName}.`}
                  {step === STEP_SCHEDULE && "Preencha a data e, se quiser, alguma orientação."}
                  {step === STEP_REVIEW && "Confira tudo antes de enviar."}
                </SheetDescription>
              </SheetHeader>

              <RequestFlowProgress currentStep={step} />
            </>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
          >
            {step === STEP_PET && (
              <RequestPetStep
                pets={pets}
                selectedPetId={values.petId}
                onSelect={(id) => setValue("petId", id, { shouldValidate: true })}
                error={errors.petId?.message}
              />
            )}

            {step === STEP_SERVICE && (
              <RequestServiceStep
                services={professional.services}
                selectedServiceId={values.serviceId}
                onSelect={(id) => setValue("serviceId", id, { shouldValidate: true })}
                error={errors.serviceId?.message}
              />
            )}

            {step === STEP_SCHEDULE && (
              <RequestScheduleStep register={register} errors={errors} todayStr={todayStr} />
            )}

            {isReview && (
              <RequestReviewStep
                professionalName={professional.displayName}
                pet={selectedPet}
                service={selectedService}
                scheduledAt={values.scheduledAt}
                notes={values.notes}
                errorMessage={submitError}
              />
            )}

            {isSuccess && (
              <RequestSuccessState
                professionalName={professional.displayName}
                trackHref="/requests"
                homeHref="/tutor"
              />
            )}

            {!isSuccess && (
              <SheetFooter className="mt-4 shrink-0 px-0 pt-2">
                {isReview ? (
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {isPending ? "Enviando…" : "Enviar solicitação"}
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className={buttonVariants({ className: "w-full" })}
                  >
                    Continuar
                  </button>
                )}
              </SheetFooter>
            )}
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
