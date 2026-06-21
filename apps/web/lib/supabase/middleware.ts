import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * updateSession — renova o JWT Supabase a cada request via middleware.
 *
 * Deve ser chamado no início de middleware.ts.
 * Sem isso, a sessão expira e o usuário é deslogado silenciosamente.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANTE: getUser() faz o refresh do JWT se necessário.
  // Não usar getSession() aqui — ela não valida com o servidor.
  const { data } = await supabase.auth.getUser();

  return { supabase, user: data.user, response } as unknown as NextResponse;
}

export type MiddlewareAuthResult = {
  supabase: ReturnType<typeof createServerClient>;
  user: Awaited<ReturnType<ReturnType<typeof createServerClient>["auth"]["getUser"]>>["data"]["user"];
  response: NextResponse;
};
