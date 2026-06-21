import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase server client — use em Server Components e Server Actions.
 *
 * Responsabilidades:
 *   - ler sessão autenticada (getUser)
 *   - validar JWT no servidor
 *   - acesso ao Storage server-side
 *
 * Regra: toda lógica de negócio (trust, ranking, CRM) usa Prisma,
 * não este cliente diretamente.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component: cookies não podem ser setados.
            // O middleware já garante o refresh.
          }
        },
      },
    }
  );
}

/**
 * Versão com service role — apenas para operações admin server-side.
 * NUNCA expor SUPABASE_SERVICE_ROLE_KEY ao browser.
 */
export async function createSupabaseServiceClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // ignorado em Server Components
          }
        },
      },
    }
  );
}
