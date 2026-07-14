"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertCircle } from "lucide-react";

import { createServiceAction } from "@/modules/professional/application/actions";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type CreateServiceInput,
  type ServiceType,
} from "@/modules/professional/domain/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Schema local do formulário.
 *
 * Preços são strings no input → convertidos para number antes da Server Action.
 * Cross-field validation (priceMax >= priceMin) espelhada do domínio.
 */
const serviceFormSchema = z
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
      error: () => "Selecione um tipo de serviço",
    }),
    priceMin: z.string().min(1, "Informe o preço mínimo"),
    priceMax: z.union([z.literal(""), z.string()]).optional(),
  })
  .superRefine((data, ctx) => {
    const min = data.priceMin ? parseFloat(data.priceMin) : undefined;
    const max = data.priceMax ? parseFloat(data.priceMax) : undefined;

    if (min !== undefined && isNaN(min)) {
      ctx.addIssue({ code: "custom", path: ["priceMin"], message: "Valor inválido" });
    }
    if (max !== undefined && isNaN(max)) {
      ctx.addIssue({ code: "custom", path: ["priceMax"], message: "Valor inválido" });
    }
    if (min !== undefined && min <= 0) {
      ctx.addIssue({ code: "custom", path: ["priceMin"], message: "Preço mínimo deve ser positivo" });
    }
    if (max !== undefined && max <= 0) {
      ctx.addIssue({ code: "custom", path: ["priceMax"], message: "Preço máximo deve ser positivo" });
    }
    if (min !== undefined && max !== undefined && !isNaN(min) && !isNaN(max) && max < min) {
      ctx.addIssue({
        code: "custom",
        path: ["priceMax"],
        message: "Preço máximo deve ser maior ou igual ao mínimo",
      });
    }
  });

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

type ServiceFormProps = {
  redirectTo?: string;
};

export function ServiceForm({
  redirectTo = "/requests",
}: ServiceFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      serviceType: undefined,
      priceMin: "",
      priceMax: "",
    },
  });

  const watchedType = watch("serviceType");

  async function onSubmit(values: ServiceFormValues) {
    setServerError(null);

    const input: CreateServiceInput = {
      name: values.name,
      description: values.description || undefined,
      serviceType: values.serviceType as ServiceType,
      priceMin: values.priceMin ? parseFloat(values.priceMin) : undefined,
      priceMax: values.priceMax ? parseFloat(values.priceMax) : undefined,
    };

    const result = await createServiceAction(input);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ServiceFormValues, { message: messages[0] });
        }
      } else {
        setServerError(result.error);
      }
      return;
    }

    router.push(redirectTo);
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

      {/* ── Tipo de serviço ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Tipo de serviço *
        </div>

        <Controller
          name="serviceType"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SERVICE_TYPES.map((type) => {
                const isSelected = field.value === type;
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
                );
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

      {/* ── Nome do serviço ───────────────────────────────────────────────── */}
      <FormField
        name="name"
        label="Nome do serviço *"
        error={errors.name?.message}
        description={
          watchedType
            ? `Ex: ${SERVICE_TYPE_LABELS[watchedType as ServiceType]} Premium, ${SERVICE_TYPE_LABELS[watchedType as ServiceType]} para Grandes Porte`
            : "Ex: Banho e Tosa Premium, Passeio Grupos Pequenos"
        }
      >
        {(field) => (
          <Input
            {...field}
            {...register("name")}
            placeholder="Dê um nome descritivo ao seu serviço"
            disabled={isSubmitting}
            autoFocus
          />
        )}
      </FormField>

      {/* ── Descrição ─────────────────────────────────────────────────────── */}
      <FormField
        name="description"
        label="Descrição (opcional)"
        error={errors.description?.message}
        description="O que inclui este serviço? Duração, diferenciais, cuidados especiais..."
      >
        {(field) => (
          <Textarea
            {...field}
            {...register("description")}
            placeholder="Ex: Inclui banho com shampoo neutro, tosa padrão, hidratação e perfume. Sessão de 1h30."
            rows={3}
            disabled={isSubmitting}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>

      {/* ── Faixa de preço ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Faixa de preço
        </div>
        <p className="text-xs text-muted-foreground">
          O preço mínimo é obrigatório e ajuda tutores a entenderem seu
          posicionamento. Preços exatos são combinados no chat.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            name="priceMin"
            label="Mínimo (R$) *"
            error={errors.priceMin?.message}
          >
            {(field) => (
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  {...field}
                  {...register("priceMin")}
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

          <FormField
            name="priceMax"
            label="Máximo (R$)"
            error={errors.priceMax?.message}
          >
            {(field) => (
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  {...field}
                  {...register("priceMax")}
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
        </div>
      </div>

      {/* ── Ações ─────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Button
          type="submit"
          className="w-full gap-2"
          disabled={isSubmitting}
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Criando serviço...
            </>
          ) : (
            "Criar serviço e ir para a fila →"
          )}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Ao menos um serviço com preço é necessário para concluir seu cadastro.
        Você pode adicionar e editar serviços a qualquer momento depois.
      </p>
    </form>
  );
}
