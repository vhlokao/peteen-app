import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Middleware Peteen
 *
 * Responsabilidades:
 *   1. Renovar o JWT Supabase a cada request (obrigatório com @supabase/ssr)
 *   2. Proteger rotas autenticadas — redirecionar para /login se não autenticado
 *   3. Redirecionar usuários autenticados que acessam /login para /dashboard
 *      (o /dashboard lê a persona no Prisma e redireciona corretamente)
 *
 * Limitações do Edge Runtime (onde o middleware roda):
 *   - Sem acesso ao Prisma — só pode verificar se há JWT válido (via getUser)
 *   - A lógica de persona (TUTOR, PROFESSIONAL) fica no /dashboard (Node.js)
 *
 * Segurança:
 *   - Usa getUser() que valida o JWT com o servidor Supabase (não apenas o cookie)
 *   - getSession() NÃO é usado aqui pois lê apenas o cookie sem validação server-side
 */

/** Prefixos de rotas que exigem sessão válida */
const PROTECTED_PREFIXES = [
  "/me",
  "/tutor",
  "/professional",
  "/admin",
  // Persona parceiro (futuro) — trailing slash evita colidir com /partners (público)
  "/partner/",
  // Rotas da Fase 4.3+ (criadas nas próximas etapas)
  "/discover",
  "/requests",
  "/pets",
  "/profile",
  "/onboarding",
  "/dashboard",
];

/** Rotas completamente públicas — nunca redirecionar para login */
const PUBLIC_PATHS = new Set(["/", "/login", "/sobre", "/como-funciona", "/termos", "/privacidade"]);

/** Prefixos de rotas de infraestrutura — sempre permitir */
const INFRA_PREFIXES = ["/auth/", "/api/"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANTE: sempre usar getUser() no middleware, nunca getSession().
  // getUser() faz uma chamada ao servidor Supabase para validar o JWT.
  // getSession() lê apenas o cookie — vulnerável a tokens manipulados.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Rotas de infraestrutura — sempre permitir ──────────────────────────
  if (INFRA_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return supabaseResponse;
  }

  // ── Verificar se a rota precisa de autenticação ───────────────────────
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // Usuário não autenticado tentando acessar rota protegida
  if (isProtectedRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Preservar destino original para redirect pós-login (via ?next=)
    // Nota: o callback de OAuth/Magic Link não usa este param automaticamente.
    // Implementação manual de ?next= fica para versão futura.
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Usuário autenticado acessando /login → redirecionar para o dashboard
  // O /dashboard (Node.js) lê a persona do Prisma e redireciona corretamente.
  if (pathname === "/login" && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.searchParams.delete("next");
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Interceptar todas as rotas exceto:
     *   - _next/static  — arquivos estáticos gerados pelo Next.js
     *   - _next/image   — otimização de imagens
     *   - favicon.ico e outros assets públicos (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
