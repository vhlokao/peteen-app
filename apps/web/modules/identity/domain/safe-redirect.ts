/**
 * isSafeRedirectPath — valida que um destino pós-login é um caminho interno
 * seguro, nunca uma URL externa (mitiga open redirect via ?next=).
 *
 * Aceita apenas paths que começam com uma única "/" (relativos à origem
 * atual). Rejeita "//host" (protocol-relative), "https://..." e qualquer
 * coisa com "://".
 */
export function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}
