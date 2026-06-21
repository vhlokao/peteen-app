"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, MapPin, User } from "lucide-react";

import { createTutorProfileAction } from "@/modules/tutor/application/actions";
import {
  CreateTutorProfileSchema,
  type CreateTutorProfileInput,
} from "@/modules/tutor/domain/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * TutorProfileForm — Client Component para onboarding de tutores.
 *
 * Responsabilidades:
 *   - Validação client-side via React Hook Form + Zod
 *   - Chamada à Server Action createTutorProfileAction
 *   - Exibe estados: idle / submitting / error
 *   - Redireciona para `redirectTo` após sucesso
 *
 * A validação também é executada no servidor (dentro da Server Action).
 * A validação client-side é apenas UX — não substitui a server-side.
 */
type TutorProfileFormProps = {
  /** Para onde redirecionar após o perfil ser criado */
  redirectTo?: string;
};

export function TutorProfileForm({
  redirectTo = "/onboarding/tutor/pet",
}: TutorProfileFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTutorProfileInput>({
    resolver: zodResolver(CreateTutorProfileSchema),
    defaultValues: {
      displayName: "",
      city: "",
      state: "",
      neighborhood: "",
      phone: "",
      bio: "",
    },
  });

  async function onSubmit(values: CreateTutorProfileInput) {
    setServerError(null);

    const result = await createTutorProfileAction(values);

    if (!result.success) {
      // Erros de campo individuais vindos do servidor
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof CreateTutorProfileInput, {
            message: messages[0],
          });
        }
      } else {
        setServerError(result.error);
      }
      return;
    }

    // Sucesso — navega para o próximo passo
    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Erro global do servidor */}
      {serverError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      ) : null}

      {/* ── Seção: Identidade ───────────────────────────────────────────── */}
      <SectionLabel icon={<User className="size-3.5" />} label="Identificação" />

      <FormField
        name="displayName"
        label="Como quer ser chamado? *"
        error={errors.displayName?.message}
        description="Será exibido para os profissionais que você contratar."
      >
        {(field) => (
          <Input
            {...field}
            {...register("displayName")}
            placeholder="Seu nome ou apelido"
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
        description="Para que profissionais possam confirmar serviços."
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
        label="Sobre você (opcional)"
        error={errors.bio?.message}
      >
        {(field) => (
          <Textarea
            {...field}
            {...register("bio")}
            placeholder="Conte um pouco sobre você e seus pets..."
            rows={3}
            disabled={isSubmitting}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>

      {/* ── Seção: Localização ──────────────────────────────────────────── */}
      <SectionLabel icon={<MapPin className="size-3.5" />} label="Localização" />

      {/* Cidade + Estado na mesma linha */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <FormField
          name="city"
          label="Cidade *"
          error={errors.city?.message}
        >
          {(field) => (
            <Input
              {...field}
              {...register("city")}
              placeholder="São Paulo"
              autoComplete="address-level2"
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
        description="Ajuda profissionais locais a te encontrarem."
      >
        {(field) => (
          <Input
            {...field}
            {...register("neighborhood")}
            placeholder="Pinheiros"
            autoComplete="address-level3"
            disabled={isSubmitting}
          />
        )}
      </FormField>

      {/* Botão de submit */}
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
          "Criar meu perfil de tutor →"
        )}
      </Button>
    </form>
  );
}

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
