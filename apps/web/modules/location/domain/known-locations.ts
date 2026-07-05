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

export const KNOWN_CITIES: readonly string[] = [
  "Carapicuíba",
  "São Paulo",
  "Osasco",
  "Barueri",
  "Cotia",
  "Jandira",
  "Itapevi",
  "Santana de Parnaíba",
]

/** UFs válidas do Brasil — fora desta lista, normalizeStateCode retorna null. */
export const BR_STATE_CODES: readonly string[] = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
]
