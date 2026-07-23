"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  ShieldCheck,
  PawPrint,
  AlertCircle,
  ArrowRight,
  Lock,
  ChevronDown,
} from "lucide-react";

import {
  signInWithMagicLink,
  signInWithGoogle,
  signInWithPassword,
} from "@/modules/identity/infrastructure/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Link de autenticação inválido. Solicite um novo link.",
  callback_failed: "Falha na autenticação. Tente novamente.",
  sync_failed: "Erro interno. Por favor, tente novamente.",
};

type LoginFormProps = {
  errorCode?: string;
  next?: string;
};

export function LoginForm({ errorCode, next }: LoginFormProps) {
  const [isPendingGoogle, startGoogleTransition] = useTransition();
  const [isPendingPassword, startPasswordTransition] = useTransition();
  const [emailSent, setEmailSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [password, setPassword] = useState("");
  // Guard síncrono contra duplo-submit (duplo clique / Enter+clique) — o
  // state `isLoading` só reflete no `disabled` após um re-render, o que
  // deixa uma janela de corrida para um segundo disparo. O ref é síncrono.
  const submitLockRef = useRef(false);

  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  // ── Magic Link ─────────────────────────────────────────────────────────────

  async function onSubmitMagicLink(values: LoginFormValues) {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setServerError(null);
    try {
      const result = await signInWithMagicLink(values.email, next);
      if (result.success) {
        setEmailSent(true);
      } else {
        setServerError(result.error);
      }
    } finally {
      submitLockRef.current = false;
    }
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  function handleGoogleSignIn() {
    setServerError(null);
    startGoogleTransition(async () => {
      try {
        await signInWithGoogle();
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (!message.includes("NEXT_REDIRECT")) {
          setServerError("Falha ao conectar com Google. Tente novamente.");
        }
      }
    });
  }

  // ── Password (dev) ─────────────────────────────────────────────────────────

  function handlePasswordSignIn() {
    if (submitLockRef.current) return;

    const email = getValues("email");
    if (!email) {
      setServerError("Informe o e-mail antes de usar senha.");
      return;
    }
    if (!password.trim()) {
      setServerError("Informe a senha.");
      return;
    }

    submitLockRef.current = true;
    setServerError(null);
    startPasswordTransition(async () => {
      try {
        const result = await signInWithPassword(email, password, next);
        if (!result.success) {
          setServerError(result.error);
        }
        // se success, signInWithPassword chama redirect() internamente
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (!message.includes("NEXT_REDIRECT")) {
          setServerError(
            message || "Credenciais inválidas. Verifique e-mail e senha."
          );
        }
      } finally {
        submitLockRef.current = false;
      }
    });
  }

  const displayError =
    serverError ??
    (errorCode
      ? (ERROR_MESSAGES[errorCode] ?? "Erro desconhecido. Tente novamente.")
      : null);

  const isLoading = isSubmitting || isPendingGoogle || isPendingPassword;

  // ── Estado: e-mail enviado ─────────────────────────────────────────────────

  if (emailSent) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#EDE9E1] p-4">
        <div className="w-full max-w-[420px] overflow-hidden rounded-[32px] border border-[#1D2F6F]/[0.06] bg-white shadow-[0_34px_70px_-24px_rgba(29,47,111,0.32),0_10px_28px_rgba(29,47,111,0.08)]">
          <div className="bg-[#FAFAF8] px-7 py-10 text-center">
            <span className="inline-grid size-14 place-items-center rounded-2xl bg-[#E8EEF6]">
              <Mail className="size-6 text-[#2C4893]" />
            </span>
            <h2 className="mt-4 text-[17px] font-bold text-[#1A1A1A]">
              Confira seu e-mail
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B6B63]">
              Enviamos um link seguro para <br />
              <strong className="text-[#1A1A1A]">{getValues("email")}</strong>.
            </p>

            <p className="mt-6 text-xs text-[#8A897F]">
              Não recebeu? Verifique a pasta de spam ou lixo eletrônico.
            </p>
            <button
              type="button"
              onClick={() => {
                setEmailSent(false);
                setServerError(null);
              }}
              className="mt-3 text-[13px] font-semibold text-[#2C4893] hover:text-[#1D2F6F]"
            >
              Usar outro e-mail
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Estado: formulário ─────────────────────────────────────────────────────

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#EDE9E1] p-4">
      <div className="w-full max-w-[420px] overflow-hidden rounded-[32px] border border-[#1D2F6F]/[0.06] bg-white shadow-[0_34px_70px_-24px_rgba(29,47,111,0.32),0_10px_28px_rgba(29,47,111,0.08)]">
        {/* Header acolhedor */}
        <div className="relative h-[230px] overflow-hidden bg-gradient-to-b from-[#2C4893] to-[#1D2F6F]">
          <div className="absolute -right-[70px] -top-[90px] size-[260px] rounded-full bg-[#6EC6FF]/[0.18]" />
          <div className="absolute -left-10 -bottom-[70px] size-[180px] rounded-full bg-[#E07A5F]/20" />
          <PawPrint className="absolute left-[52px] top-16 size-9 text-white/50" />
          <div className="absolute inset-x-9 bottom-9">
            <span className="grid size-[52px] place-items-center rounded-2xl bg-white text-2xl font-extrabold text-[#1D2F6F] shadow-lg">
              P
            </span>
            <h1 className="mt-[18px] text-[26px] font-extrabold leading-tight tracking-tight text-white">
              Bem-vindo ao Peteen
            </h1>
          </div>
        </div>

        {/* Corpo */}
        <div className="bg-[#FAFAF8] px-7 pb-9 pt-6">
          <p className="mb-5 text-[14.5px] leading-relaxed text-[#57564E]">
            Encontre quem cuida do seu pet com{" "}
            <strong className="text-[#1A1A1A]">confiança de verdade</strong>.
            Entre ou crie sua conta no mesmo lugar.
          </p>

          <form onSubmit={handleSubmit(onSubmitMagicLink)} noValidate>
            <label
              htmlFor="email"
              className="mb-2 block text-[12.5px] font-bold text-[#1A1A1A]"
            >
              Seu e-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#2C4893]" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="voce@email.com"
                disabled={isLoading}
                aria-invalid={!!errors.email}
                {...register("email")}
                className="h-[52px] rounded-[15px] border-[1.5px] bg-white pl-11 text-[15px] font-medium text-[#1A1A1A] focus-visible:border-[#2C4893] focus-visible:ring-4 focus-visible:ring-[#2C4893]/10 aria-[invalid=true]:border-[#E07A5F] aria-[invalid=true]:ring-0"
              />
            </div>

            {errors.email?.message ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#C15A3F]">
                <AlertCircle className="size-[15px]" />
                {errors.email.message}
              </p>
            ) : null}

            {displayError ? (
              <div
                role="alert"
                className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#C15A3F]"
              >
                <AlertCircle className="size-[15px] shrink-0" />
                <span>{displayError}</span>
              </div>
            ) : null}

            {/* Campo de senha — visível somente quando expandido */}
            {showPasswordSection && (
              <div className="mt-4 space-y-1.5">
                <label
                  htmlFor="password-input"
                  className="block text-[12.5px] font-bold text-[#1A1A1A]"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#2C4893]" />
                  <Input
                    id="password-input"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-[52px] rounded-[15px] border-[1.5px] bg-white pl-11 text-[15px] font-medium text-[#1A1A1A] focus-visible:border-[#2C4893] focus-visible:ring-4 focus-visible:ring-[#2C4893]/10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePasswordSignIn();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Magic Link — botão primário */}
            {!showPasswordSection && (
              <Button
                type="submit"
                disabled={isLoading}
                className="mt-4 h-auto w-full gap-2 rounded-[15px] bg-[#1D2F6F] py-4 text-[15.5px] font-bold text-white shadow-[0_12px_24px_-8px_rgba(29,47,111,0.55)] hover:bg-[#182860]"
              >
                {isSubmitting ? "Enviando…" : "Continuar"}
                {!isSubmitting && <ArrowRight className="size-[18px]" />}
              </Button>
            )}

            {/* Senha — botão visível apenas quando expandido */}
            {showPasswordSection && (
              <div className="mt-4 space-y-2">
                <Button
                  type="button"
                  onClick={handlePasswordSignIn}
                  disabled={isLoading}
                  className="h-auto w-full gap-2 rounded-[15px] bg-[#1D2F6F] py-4 text-[15.5px] font-bold text-white shadow-[0_12px_24px_-8px_rgba(29,47,111,0.55)] hover:bg-[#182860]"
                >
                  {isPendingPassword ? "Entrando…" : "Entrar com senha"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setPassword("");
                    setServerError(null);
                  }}
                  disabled={isLoading}
                  className="w-full text-center text-[12.5px] font-medium text-[#8A897F] hover:text-[#57564E] disabled:cursor-not-allowed"
                >
                  ← Voltar para Magic Link
                </button>
              </div>
            )}
          </form>

          {!showPasswordSection && (
            <>
              <div className="mt-4 flex items-start gap-2.5 rounded-[13px] bg-[#E8EEF6] px-3.5 py-3">
                <ShieldCheck className="mt-0.5 size-[17px] shrink-0 text-[#2C4893]" />
                <p className="text-[12.5px] leading-snug text-[#2C4893]">
                  <strong>Sem senha para lembrar.</strong> Enviamos um link
                  seguro para seu e-mail — é só tocar e entrar.
                </p>
              </div>

              {/* Google OAuth — oculto por ora (apenas Magic Link no teste real) */}
              <div className="hidden">
                <div className="my-5 flex items-center gap-3.5">
                  <span className="h-px flex-1 bg-[#1D2F6F]/10" />
                  <span className="text-xs font-semibold text-[#8A897F]">
                    ou
                  </span>
                  <span className="h-px flex-1 bg-[#1D2F6F]/10" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="h-auto w-full gap-2.5 rounded-[15px] border-[1.5px] border-[#1D2F6F]/[0.14] bg-white py-3.5 text-[14.5px] font-bold text-[#1A1A1A] hover:bg-[#FAFAF8]"
                >
                  <GoogleLogoIcon />
                  {isPendingGoogle ? "Redirecionando…" : "Continuar com Google"}
                </Button>
              </div>

              <p className="mt-5 text-center text-[12.5px] text-[#8A897F]">
                Ao continuar, você concorda com os{" "}
                <a
                  href="/termos"
                  className="font-semibold text-[#2C4893] hover:text-[#1D2F6F]"
                >
                  termos de uso
                </a>{" "}
                e{" "}
                <a
                  href="/privacidade"
                  className="font-semibold text-[#2C4893] hover:text-[#1D2F6F]"
                >
                  privacidade
                </a>
                .
              </p>

              {/* Toggle senha — discreto, no rodapé */}
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(true);
                  setServerError(null);
                }}
                disabled={isLoading}
                className="mx-auto mt-3 flex items-center gap-1 text-[11.5px] text-[#A9A79C] transition-colors hover:text-[#8A897F] disabled:cursor-not-allowed"
              >
                <ChevronDown className="size-3" />
                Entrar com senha
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/** Ícone oficial do Google — não disponível no lucide-react */
function GoogleLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("size-[18px]", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
