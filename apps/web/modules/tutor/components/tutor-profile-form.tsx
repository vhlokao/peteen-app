"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, MapPin } from "lucide-react";

import { createTutorProfileAction } from "@/modules/tutor/application/actions";
import {
  CreateTutorProfileSchema,
  type CreateTutorProfileInput,
} from "@/modules/tutor/domain/types";
import { KNOWN_LOCATIONS, findKnownCityState } from "@/modules/location";

const NAVY = "#1D2F6F";

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
    setValue,
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

        <Field label="Seu nome *" error={errors.displayName?.message}>
          <input
            {...register("displayName")}
            placeholder="Seu nome ou apelido"
            autoComplete="name"
            autoFocus
            disabled={isSubmitting}
            className="w-full rounded-[14px] border-[1.5px] border-black/10 bg-white px-4 py-3.5 text-[14.5px] font-medium outline-none transition focus:border-[#2C4893] focus:shadow-[0_0_0_4px_rgba(44,72,147,.10)] disabled:opacity-60"
          />
        </Field>

        <div className="h-[18px]" />

        <Field label="Sua cidade *" error={errors.city?.message}>
          <Controller
            name="city"
            control={control}
            render={({ field: cityField }) => (
              <div className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-black/10 bg-white px-4 py-3.5 focus-within:border-[#2C4893] focus-within:shadow-[0_0_0_4px_rgba(44,72,147,.10)]">
                <MapPin className="size-[17px] shrink-0 text-[#8A897F]" />
                <select
                  value={cityField.value}
                  onChange={(e) => {
                    const city = e.target.value;
                    cityField.onChange(city);
                    setValue("state", findKnownCityState(city) ?? "", {
                      shouldValidate: true,
                    });
                  }}
                  onBlur={cityField.onBlur}
                  disabled={isSubmitting}
                  className="w-full bg-transparent text-[14.5px] outline-none disabled:opacity-60"
                >
                  <option value="">Selecione a cidade</option>
                  {KNOWN_LOCATIONS.map((loc) => (
                    <option key={loc.city} value={loc.city}>
                      {loc.city}
                    </option>
                  ))}
                </select>
              </div>
            )}
          />
        </Field>
        {/* Estado é preenchido automaticamente a partir da cidade selecionada */}
        <input type="hidden" {...register("state")} />
        {errors.state?.message ? (
          <p className="mt-1.5 text-[12px] font-medium text-[#C15A3F]">
            {errors.state.message}
          </p>
        ) : null}

        <p className="mt-2 text-[11.5px] leading-relaxed text-[#8A897F]">
          Usamos só cidade/UF para mostrar profissionais da sua região.
        </p>

        <div className="h-[18px]" />

        <Field label="Bairro (opcional)" error={errors.neighborhood?.message}>
          <input
            {...register("neighborhood")}
            placeholder="Pinheiros"
            autoComplete="address-level3"
            disabled={isSubmitting}
            className="w-full rounded-[14px] border-[1.5px] border-black/10 bg-white px-4 py-3.5 text-[14.5px] font-medium outline-none transition focus:border-[#2C4893] focus:shadow-[0_0_0_4px_rgba(44,72,147,.10)] disabled:opacity-60"
          />
        </Field>

        <div className="h-[18px]" />

        <Field label="WhatsApp (opcional)" error={errors.phone?.message}>
          <input
            {...register("phone")}
            type="tel"
            placeholder="+55 11 9 9999-9999"
            autoComplete="tel"
            disabled={isSubmitting}
            className="w-full rounded-[14px] border-[1.5px] border-black/10 bg-white px-4 py-3.5 text-[14.5px] font-medium outline-none transition focus:border-[#2C4893] focus:shadow-[0_0_0_4px_rgba(44,72,147,.10)] disabled:opacity-60"
          />
        </Field>

        <div className="h-[18px]" />

        <Field label="Sobre você (opcional)" error={errors.bio?.message}>
          <textarea
            {...register("bio")}
            placeholder="Conte um pouco sobre você e seus pets..."
            rows={3}
            disabled={isSubmitting}
            className="w-full resize-none rounded-[14px] border-[1.5px] border-black/10 bg-white px-4 py-3.5 text-[14.5px] font-medium outline-none transition focus:border-[#2C4893] focus:shadow-[0_0_0_4px_rgba(44,72,147,.10)] disabled:opacity-60"
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
          {isSubmitting ? "Criando perfil…" : "Continuar"}
        </button>
      </footer>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[#1A1A1A]">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#C15A3F]">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </span>
      ) : null}
    </label>
  );
}
