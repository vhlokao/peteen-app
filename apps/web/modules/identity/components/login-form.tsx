"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, CheckCircle2, AlertCircle, Loader2, Lock, ChevronDown } from "lucide-react";

import {
  signInWithMagicLink,
  signInWithGoogle,
  signInWithPassword,
} from "@/modules/identity/infrastructure/auth-actions";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
};

export function LoginForm({ errorCode }: LoginFormProps) {
  const [isPendingGoogle, startGoogleTransition] = useTransition();
  const [isPendingPassword, startPasswordTransition] = useTransition();
  const [emailSent, setEmailSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [password, setPassword] = useState("");

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
    setServerError(null);
    try {
      await signInWithMagicLink(values.email);
      setEmailSent(true);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Erro ao enviar e-mail."
      );
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
    const email = getValues("email");
    if (!email) {
      setServerError("Informe o e-mail antes de usar senha.");
      return;
    }
    if (!password.trim()) {
      setServerError("Informe a senha.");
      return;
    }

    setServerError(null);
    startPasswordTransition(async () => {
      try {
        await signInWithPassword(email, password);
        // signInWithPassword chama redirect() internamente
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (!message.includes("NEXT_REDIRECT")) {
          setServerError(
            message || "Credenciais inválidas. Verifique e-mail e senha."
          );
        }
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
      <Card>
        <CardHeader className="items-center space-y-3 pb-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-trust/10">
            <CheckCircle2 className="size-7 text-trust" />
          </div>
          <CardTitle>Link enviado!</CardTitle>
          <CardDescription>
            Enviamos um link seguro para{" "}
            <strong className="font-semibold text-foreground">
              {getValues("email")}
            </strong>
            . Clique no link para entrar.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2 pt-0">
          <p className="text-center text-xs text-muted-foreground">
            Não recebeu? Verifique a pasta de spam ou lixo eletrônico.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEmailSent(false);
              setServerError(null);
            }}
            className="w-full"
          >
            Usar outro e-mail
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ── Estado: formulário ─────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar no Peteen</CardTitle>
        <CardDescription>
          Digite seu email e enviaremos um link de acesso. Se você ainda não tem
          conta, ela será criada automaticamente.
        </CardDescription>
      </CardHeader>

      {displayError ? (
        <div
          role="alert"
          className="mx-6 mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{displayError}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmitMagicLink)} noValidate>
        <CardContent className="space-y-4">
          {/* E-mail — compartilhado por todos os métodos */}
          <FormField
            name="email"
            label="E-mail"
            error={errors.email?.message}
          >
            {(field) => (
              <Input
                {...field}
                {...register("email")}
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                autoFocus
                disabled={isLoading}
              />
            )}
          </FormField>

          {/* Campo de senha — visível somente quando expandido */}
          {showPasswordSection && (
            <div className="space-y-1.5">
              <label
                htmlFor="password-input"
                className="text-sm font-medium text-foreground"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password-input"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-9"
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
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {/* Magic Link — botão primário */}
          {!showPasswordSection && (
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={isLoading}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              {isSubmitting ? "Enviando link..." : "Continuar com e-mail"}
            </Button>
          )}

          {/* Senha — botão visível apenas quando expandido */}
          {showPasswordSection && (
            <>
              <Button
                type="button"
                className="w-full gap-2"
                onClick={handlePasswordSignIn}
                disabled={isLoading}
              >
                {isPendingPassword ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Lock className="size-4" />
                )}
                {isPendingPassword ? "Entrando..." : "Entrar com senha"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setShowPasswordSection(false);
                  setPassword("");
                  setServerError(null);
                }}
                disabled={isLoading}
              >
                ← Voltar para Magic Link
              </Button>
            </>
          )}

          {/* Divisor — escondido junto com o Google (login por Magic Link apenas) */}
          {!showPasswordSection && (
            <div className="hidden w-full items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Google OAuth — oculto por ora (apenas Magic Link no teste real) */}
          {!showPasswordSection && (
            <Button
              type="button"
              variant="outline"
              className="hidden w-full gap-2"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isPendingGoogle ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GoogleLogoIcon />
              )}
              {isPendingGoogle ? "Redirecionando..." : "Continuar com Google"}
            </Button>
          )}

          {/* Termos */}
          {!showPasswordSection && (
            <p className="text-center text-xs text-muted-foreground">
              Ao continuar, você concorda com os{" "}
              <a
                href="/termos"
                className="underline underline-offset-2 hover:text-foreground"
              >
                termos de uso
              </a>{" "}
              e{" "}
              <a
                href="/privacidade"
                className="underline underline-offset-2 hover:text-foreground"
              >
                privacidade
              </a>
              .
            </p>
          )}

          {/* Toggle senha — discreto, no rodapé */}
          {!showPasswordSection && (
            <button
              type="button"
              onClick={() => {
                setShowPasswordSection(true);
                setServerError(null);
              }}
              disabled={isLoading}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground disabled:cursor-not-allowed"
            >
              <ChevronDown className="size-3" />
              Entrar com senha
            </button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

/** Ícone oficial do Google — não disponível no lucide-react */
function GoogleLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("size-4", className)}
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
