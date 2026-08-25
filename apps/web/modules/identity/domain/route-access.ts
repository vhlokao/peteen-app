/**
 * Classificação de acesso por rota — decide se um caminho exige sessão.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO SAIU DO MIDDLEWARE
 *
 * A regra vivia como uma sequência de `if`s e `.some()` sobre arrays dentro do
 * middleware, onde não era testável: middleware roda no Edge, recebe
 * `NextRequest` e não é importável por `node --test`. Uma exceção nova
 * dependia de estar no lugar certo de uma ordem que ninguém verificava.
 *
 * Como função pura sobre uma string, cada caso vira asserção — inclusive os
 * que importam mais, que são os NÃO-casos: "/onboarding/partner é público" só
 * significa alguma coisa junto de "/onboarding/tutor continua protegido".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O CONFLITO QUE ISTO RESOLVE
 *
 * `/onboarding/partner` foi desenhado como funil PÚBLICO — quem preenche é um
 * negócio que ainda não tem conta. Mas `/onboarding` inteiro está na lista de
 * prefixos protegidos (por causa de tutor e profissional, que exigem sessão),
 * e `startsWith` não distingue os dois. O resultado era um funil público atrás
 * de uma parede de login: visitante anônimo caía em
 * `/login?next=/onboarding/partner`.
 *
 * A exceção é declarada ANTES da avaliação genérica e é EXATA, não por
 * prefixo: liberar `/onboarding/partner*` abriria qualquer sub-rota futura sem
 * ninguém decidir isso.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTA CAMADA NÃO É AUTORIZAÇÃO
 *
 * O que se decide aqui é se a UI abre. Ler ou alterar dados de um Partner
 * continua exigindo a capability assinada, verificada dentro de cada Server
 * Action (ver modules/partners/application/onboarding-session.ts). Tornar a
 * página pública não remove validação nenhuma do servidor — abrir o formulário
 * e poder operar sobre um parceiro são coisas diferentes.
 */

/** Prefixos que exigem sessão válida. */
export const PROTECTED_PREFIXES = [
  "/me",
  "/tutor",
  "/professional",
  "/admin",
  "/discover",
  "/requests",
  "/pets",
  "/profile",
  "/onboarding",
  "/dashboard",
] as const

/**
 * Infraestrutura e superfícies públicas por definição.
 *
 * `/p/` é a landing de convite do profissional: precisa abrir sem sessão,
 * porque o público-alvo é justamente quem ainda não tem conta.
 */
export const INFRA_PREFIXES = ["/auth/", "/api/", "/p/"] as const

/**
 * Exceções EXATAS a um prefixo protegido.
 *
 * Correspondência exata, e não por prefixo, de propósito: uma sub-rota criada
 * amanhã sob `/onboarding/partner/` não deve herdar acesso público sem que
 * alguém decida isso explicitamente.
 */
export const PUBLIC_EXACT_PATHS = ["/onboarding/partner"] as const

export type RouteAccess = "infra" | "public" | "protected"

/** O portal do parceiro autenticado. Prefixo exato evita colidir com `/partners` (público). */
export function isPartnerPortalRoute(pathname: string): boolean {
  return pathname === "/partner" || pathname.startsWith("/partner/")
}

/**
 * Como esta rota deve ser tratada.
 *
 * A ordem é significativa e está aqui — não espalhada pelo middleware:
 *   1. infra passa direto;
 *   2. exceções públicas exatas vencem o prefixo protegido que as contém;
 *   3. só então a avaliação genérica de prefixo.
 */
export function classifyRoute(pathname: string): RouteAccess {
  if (INFRA_PREFIXES.some((p) => pathname.startsWith(p))) return "infra"

  // Antes da avaliação genérica: é isto que impede `/onboarding` de capturar
  // `/onboarding/partner`.
  if (PUBLIC_EXACT_PATHS.some((p) => pathname === p)) return "public"

  if (isPartnerPortalRoute(pathname)) return "protected"
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) return "protected"

  return "public"
}

/** Atalho para o middleware: esta rota exige sessão? */
export function requiresSession(pathname: string): boolean {
  return classifyRoute(pathname) === "protected"
}
