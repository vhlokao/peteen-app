/**
 * módulo: location
 * camada: domain — dicionário explícito de localidades suportadas
 *
 * Regra da Foundation V0: acento NUNCA é inventado por algoritmo. A grafia
 * canônica (com acento) só é restaurada quando a cidade consta neste mapa —
 * comparação case/accent-insensitive contra a forma canônica. Fora do mapa,
 * o nome recebe apenas capitalização segura, preservando o que o usuário digitou.
 *
 * Escopo inicial: região oeste da Grande São Paulo, onde a estratégia
 * bairro → região → cidade começa (ver PETEEN_MASTER_CONTEXT_v2.md / Growth).
 * Adicionar cidades aqui conforme a operação expandir — uma linha por cidade.
 */

/**
 * Fonte única das localidades suportadas — cada cidade com sua UF canônica.
 * `KNOWN_CITIES` é derivado daqui para não quebrar consumidores existentes
 * (normalize.ts) e o select de cidade do onboarding usa a UF para
 * autopreencher o estado.
 */
export const KNOWN_LOCATIONS: readonly { city: string; state: string }[] = [
  { city: "Carapicuíba", state: "SP" },
  { city: "São Paulo", state: "SP" },
  { city: "Osasco", state: "SP" },
  { city: "Barueri", state: "SP" },
  { city: "Cotia", state: "SP" },
  { city: "Jandira", state: "SP" },
  { city: "Itapevi", state: "SP" },
  { city: "Santana de Parnaíba", state: "SP" },
]

export const KNOWN_CITIES: readonly string[] = KNOWN_LOCATIONS.map((l) => l.city)

/**
 * findKnownCityState — retorna a UF canônica de uma cidade do dicionário,
 * ou null se a cidade não constar. Comparação exata contra a grafia canônica
 * (o select do onboarding só oferece essas grafias).
 */
export function findKnownCityState(city: string): string | null {
  return KNOWN_LOCATIONS.find((l) => l.city === city)?.state ?? null
}

/** UFs válidas do Brasil — fora desta lista, normalizeStateCode retorna null. */
export const BR_STATE_CODES: readonly string[] = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
]
