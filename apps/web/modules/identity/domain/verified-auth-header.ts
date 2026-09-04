/**
 * Módulo: identity
 * Camada: domain — nome do header interno de identidade já validada.
 *
 * GATE-3-AUTH-LATENCY-005.
 *
 * `middleware.ts` chama `supabase.auth.getUser()` (valida o JWT contra o
 * servidor do Supabase — chamada de rede real) em TODO request que passa
 * pelo matcher. `getAuthContext()` (application/get-session.ts) fazia essa
 * MESMA chamada de novo, dentro do mesmo request HTTP, para o mesmo efeito:
 * descobrir quem é o usuário. `cache()` do React deduplica chamadas a
 * `getAuthContext()` DENTRO do mesmo render/action, mas não existe cache
 * entre o middleware (Edge) e a aplicação (Node) — são runtimes diferentes,
 * sem estado de módulo compartilhado.
 *
 * A única ponte entre os dois é a própria requisição: o middleware escreve
 * o `authId` (já validado) num header interno; a aplicação lê esse header
 * em vez de validar de novo. Extraído para este arquivo — em vez de um
 * literal duplicado em cada ponta — porque os dois lados precisam usar
 * EXATAMENTE o mesmo nome: se divergissem, o pior caso possível é o atalho
 * silenciosamente parar de funcionar (a aplicação nunca vê o header
 * esperado e cai no fallback de sempre validar de novo) — nunca um caso
 * mais inseguro, mas ainda assim um bug bobo de se ter por duplicação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO NÃO É UM RISCO DE SPOOFING
 *
 * O NOME do header não é segredo — está neste arquivo, público no
 * repositório. A segurança não vem de o nome ser desconhecido, vem de
 * `middleware.ts` SEMPRE remover qualquer valor deste header vindo do
 * cliente antes de decidir se escreve um novo (ver o comentário grande em
 * `middleware.ts`, junto de onde isso acontece). Um cliente que mande este
 * header numa requisição real nunca o vê chegar à aplicação — ele é
 * apagado e, quando muito, recriado do zero a partir do resultado de
 * `getUser()`, nunca copiado.
 */
export const VERIFIED_AUTH_ID_HEADER = "x-peteen-verified-auth-id"
