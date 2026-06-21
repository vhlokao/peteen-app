"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client — use only in Client Components.
 *
 * Responsabilidades:
 *   - escutar mudanças de auth state (onAuthStateChange)
 *   - upload de arquivos via Supabase Storage
 *   - login/logout UI-driven
 *
 * NÃO usar para:
 *   - mutações de trust score, ranking, CRM
 *   - leitura de dados de negócio (use Server Actions + Prisma)
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
