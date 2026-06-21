"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertCircle, MapPin, User, Briefcase, X } from "lucide-react";

import { createProfessionalProfileAction } from "@/modules/professional/application/actions";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type CreateProfessionalProfileInput,
  type ServiceType,
} from "@/modules/professional/domain/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Schema do formulário — separado do CreateProfessionalProfileSchema do domínio.
 *
 * Por que separado:
 *   - `state: z.string().toUpperCase()` tem transform incompatível com RHF generics
 *   - `specializations: z.array(...).default([])` tem input opcional mas output required
 *   - O formulário valida apenas o input; a Server Action valida o output completo
 */
const professionalFormSchema = z.object({
  displayName: z
    .string()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(100, "Nome muito longo"),
  bio: z.string().max(1000, "Bio pode ter no máximo 1000 caracteres").optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{8,20}$/, "Telefone inválido")
    .optional()
    .or(z.literal("")),
  neighborhood: z.string().max(100).optional(),
  city: z.string().min(2, "Cidade é obrigatória").max(100),
  state: z.string().length(2, "Use a sigla do estado (ex: SP)"),
  serviceTypes: z
    .array(z.enum(SERVICE_TYPES))
    .min(1, "Selecione ao menos um tipo de serviço"),
  specializations: z.array(z.string().max(50)),
});

type ProfessionalFormValues = z.infer<typeof professionalFormSchema>;

type ProfessionalProfileFormProps = {
  redirectTo?: string;
};

export function ProfessionalProfileForm({
  redirectTo = "/onboarding/professional/service",
}: ProfessionalProfileFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfessionalFormValues>({
    resolver: zodResolver(professionalFormSchema),
    defaultValues: {
      displayName: "",
      bio: "",
      phone: "",
      neighborhood: "",
      city: "",
      state: "",
      serviceTypes: [],
      specializations: [],
    },
  });

  async function onSubmit(values: ProfessionalFormValues) {
    setServerError(null);

    // Constrói o input do domínio (com state em uppercase para o servidor)
    const input: CreateProfessionalProfileInput = {
      ...values,
      state: values.state.toUpperCase(),
      specializations: values.specializations,
    };

    const result = await createProfessionalProfileAction(input);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ProfessionalFormValues, {
            message: messages[0],
          });
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

      {/* ── Identificação ─────────────────────────────────────────────────── */}
      <SectionLabel icon={<User className="size-3.5" />} label="Identificação" />

      <FormField
        name="displayName"
        label="Nome profissional *"
        error={errors.displayName?.message}
        description="Como seus clientes irão te encontrar."
      >
        {(field) => (
          <Input
            {...field}
            {...register("displayName")}
            placeholder="Seu nome ou nome do negócio"
            autoComplete="name"
            autoFocus
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <FormField
        name="phone"
        label="WhatsApp (opcional)"
        error={errors.phone?.message}
        description="Para tutores confirmarem agendamentos."
      >
        {(field) => (
          <Input
            {...field}
            {...register("phone")}
            type="tel"
            placeholder="+55 11 9 9999-9999"
            autoComplete="tel"
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <FormField
        name="bio"
        label="Apresentação (opcional)"
        error={errors.bio?.message}
        description="Conte sua experiência, certificações e diferenciais."
      >
        {(field) => (
          <Textarea
            {...field}
            {...register("bio")}
            placeholder="Ex: Médico veterinário com 10 anos de experiência em pequenos animais..."
            rows={4}
            disabled={isSubmitting}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>

      {/* ── Localização ───────────────────────────────────────────────────── */}
      <SectionLabel icon={<MapPin className="size-3.5" />} label="Localização" />

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <FormField name="city" label="Cidade *" error={errors.city?.message}>
          {(field) => (
            <Input
              {...field}
              {...register("city")}
              placeholder="São Paulo"
              disabled={isSubmitting}
            />
          )}
        </FormField>

        <FormField
          name="state"
          label="Estado *"
          error={errors.state?.message}
          className="w-20"
        >
          {(field) => (
            <Controller
              name="state"
              control={control}
              render={({ field: stateField }) => (
                <Input
                  {...field}
                  value={stateField.value}
                  onChange={(e) =>
                    stateField.onChange(
                      e.target.value.toUpperCase().slice(0, 2)
                    )
                  }
                  onBlur={stateField.onBlur}
                  placeholder="SP"
                  maxLength={2}
                  className="uppercase"
                  disabled={isSubmitting}
                />
              )}
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
            placeholder="Pinheiros"
            disabled={isSubmitting}
          />
        )}
      </FormField>

      {/* ── Tipos de serviço ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel
          icon={<Briefcase className="size-3.5" />}
          label="Tipos de serviço *"
        />
        <p className="text-xs text-muted-foreground">
          Selecione todos os serviços que você oferece. Mínimo: 1.
        </p>

        <Controller
          name="serviceTypes"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SERVICE_TYPES.map((type) => {
                const isSelected = field.value.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isSubmitting}
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (isSelected) {
                        field.onChange(field.value.filter((t: ServiceType) => t !== type));
                      } else {
                        field.onChange([...field.value, type]);
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
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      )}
                    >
                      {isSelected && (
                        <svg className="size-2.5" fill="none" viewBox="0 0 12 12">
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
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

        {errors.serviceTypes?.message ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.serviceTypes.message}
          </p>
        ) : null}
      </div>

      {/* ── Especializações ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Especializações (opcional)
        </label>
        <p className="text-xs text-muted-foreground">
          Ex: Cuidados paliativos, Raças grandes, Animais exóticos. Pressione{" "}
          <kbd className="rounded border px-1 py-0.5 text-[0.6rem] font-mono">Enter</kbd>{" "}
          para adicionar.
        </p>

        <Controller
          name="specializations"
          control={control}
          render={({ field }) => (
            <TagInput
              value={field.value}
              onChange={field.onChange}
              placeholder="Digite e pressione Enter..."
              maxTags={20}
              maxLength={50}
              disabled={isSubmitting}
            />
          )}
        />

        {errors.specializations?.message ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.specializations.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="w-full gap-2"
        disabled={isSubmitting}
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Criando perfil...
          </>
        ) : (
          "Criar perfil de profissional →"
        )}
      </Button>
    </form>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function SectionLabel({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {icon}
      {label}
    </div>
  );
}

/**
 * TagInput — campo de entrada para arrays de strings.
 *
 * Comportamento:
 *   - Enter ou vírgula → adiciona tag
 *   - Backspace com campo vazio → remove última tag
 *   - onBlur com texto pendente → adiciona automaticamente
 *   - Máximo de `maxTags` tags e `maxLength` chars por tag
 */
function TagInput({
  value,
  onChange,
  placeholder,
  maxTags = 20,
  maxLength = 50,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxLength?: number;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (tag && !value.includes(tag) && tag.length <= maxLength && value.length < maxTags) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-input bg-transparent p-2 transition-colors",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={`Remover ${tag}`}
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}

      {value.length < maxTags && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) addTag(input); }}
          placeholder={value.length === 0 ? placeholder : "Adicionar..."}
          disabled={disabled}
          className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}
