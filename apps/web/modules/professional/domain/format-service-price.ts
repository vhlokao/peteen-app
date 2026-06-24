type ServicePrice = {
  priceMin: number | null
  priceMax: number | null
}

/** Preço para exibição pública (perfil discover, listagem de serviços). */
export function formatPublicServicePrice({ priceMin, priceMax }: ServicePrice): string | null {
  if (priceMin == null && priceMax == null) return null

  if (priceMin != null && priceMax != null) {
    if (priceMin === priceMax) return `R$ ${priceMin}`
    return `R$ ${priceMin}–${priceMax}`
  }
  if (priceMin != null) return `A partir de R$ ${priceMin}`
  return `Até R$ ${priceMax!}`
}

/** Variante compacta entre parênteses (ex.: select de solicitação). */
export function formatPublicServicePriceCompact({ priceMin, priceMax }: ServicePrice): string {
  if (priceMin != null && priceMax != null) {
    if (priceMin === priceMax) return ` (R$ ${priceMin})`
    return ` (R$ ${priceMin}–${priceMax})`
  }
  if (priceMin != null) return ` (a partir de R$ ${priceMin})`
  return ""
}
