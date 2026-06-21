/**
 * Gera slug URL-safe a partir do nome do negócio.
 * Função pura — sem IO.
 */
export function generatePartnerSlug(businessName: string): string {
  return businessName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
