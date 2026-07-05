/**
 * módulo: location
 * camada: domain — normalização de texto de localização
 *
 * Funções puras, sem IO. Regras:
 *   - trim + colapso de espaços duplicados;
 *   - string vazia/whitespace vira null;
 *   - acentos são PRESERVADOS, nunca inventados — restauração de grafia
 *     canônica só via dicionário explícito (known-locations.ts);
 *   - capitalização segura em pt-BR (conectivos "de/da/do/das/dos/e" ficam
 *     minúsculos, exceto quando são a primeira palavra);
 *   - comparação sempre case-insensitive e accent-insensitive.
 */

import { KNOWN_CITIES, BR_STATE_CODES } from "./known-locations.ts"

/** Trim + colapsa qualquer sequência de whitespace em um espaço. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** Remove diacríticos apenas para fins de COMPARAÇÃO — nunca para exibição. */
export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/**
 * Compara dois textos de localização ignorando caixa, acentos e espaços
 * extras. `null`/`undefined`/vazio nunca é igual a nada (nem a si mesmo) —
 * ausência de dado não é um "lugar".
 */
export function compareLocationText(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false
  const na = stripDiacritics(collapseWhitespace(a)).toLowerCase()
  const nb = stripDiacritics(collapseWhitespace(b)).toLowerCase()
  if (na.length === 0 || nb.length === 0) return false
  return na === nb
}

const LOWERCASE_CONNECTIVES = new Set(["de", "da", "do", "das", "dos", "e"])

/**
 * Capitalização segura pt-BR: primeira letra de cada palavra maiúscula,
 * resto minúsculo, conectivos em minúsculo (exceto na primeira posição).
 * Preserva acentos existentes; não adiciona nenhum.
 */
export function titleCaseSafe(value: string): string {
  const collapsed = collapseWhitespace(value)
  if (collapsed.length === 0) return collapsed
  return collapsed
    .split(" ")
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR")
      if (index > 0 && LOWERCASE_CONNECTIVES.has(lower)) return lower
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1)
    })
    .join(" ")
}

/**
 * Normaliza nome de cidade:
 *   1. vazio → null;
 *   2. se casar (case/accent-insensitive) com uma cidade do dicionário,
 *      retorna a grafia canônica (ex: "carapicuiba" → "Carapicuíba");
 *   3. senão, capitalização segura preservando os acentos que já existem.
 */
export function normalizeCityName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const collapsed = collapseWhitespace(raw)
  if (collapsed.length === 0) return null

  const canonical = KNOWN_CITIES.find((city) => compareLocationText(city, collapsed))
  if (canonical) return canonical

  return titleCaseSafe(collapsed)
}

/**
 * Normaliza nome de bairro: vazio → null; capitalização segura. Sem
 * dicionário de bairros na V0 (o cadastro estruturado de Neighborhood do
 * Growth Engine é a fonte canônica futura — não inventar grafia aqui).
 */
export function normalizeNeighborhoodName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const collapsed = collapseWhitespace(raw)
  if (collapsed.length === 0) return null
  return titleCaseSafe(collapsed)
}

/**
 * Normaliza UF: aceita exatamente uma sigla válida do Brasil (qualquer caixa),
 * retorna maiúscula ("sp" → "SP"). Qualquer outra coisa → null — nunca tentar
 * adivinhar UF a partir de nome de estado por extenso na V0.
 */
export function normalizeStateCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const collapsed = collapseWhitespace(raw).toUpperCase()
  if (!/^[A-Z]{2}$/.test(collapsed)) return null
  return BR_STATE_CODES.includes(collapsed) ? collapsed : null
}
