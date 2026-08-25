import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  /**
   * Chave HMAC da capability de onboarding de parceiro.
   *
   * `.optional()` e não obrigatória DE PROPÓSITO: este arquivo faz `parse` no
   * carregamento do módulo, então exigir a variável derrubaria a aplicação
   * inteira — inclusive telas que nada têm a ver com parceiro — sempre que ela
   * faltasse. O onboarding falha fechado sozinho quando o segredo não está lá
   * (ver modules/partners/application/onboarding-session.ts); transformar isso
   * numa queda global trocaria uma indisponibilidade parcial por uma total.
   *
   * O que a validação central GARANTE é o formato: se a variável existir, ela
   * precisa ter entropia de chave. Um segredo curto passar despercebido é pior
   * que um ausente — o ausente falha alto, o fraco assina.
   */
  ONBOARDING_SIGNING_SECRET: z
    .string()
    .min(32, "ONBOARDING_SIGNING_SECRET precisa de ao menos 32 bytes de entropia")
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  ONBOARDING_SIGNING_SECRET: process.env.ONBOARDING_SIGNING_SECRET,
});
