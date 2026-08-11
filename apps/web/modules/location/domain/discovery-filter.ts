/**
 * módulo: location
 * camada: domain — resolução do filtro de cidade do Discovery
 *
 * POR QUE EXISTE — a auditoria de Location provou uma divergência entre o que a
 * tela mostrava e o que a query fazia:
 *
 *   Tutor de Carapicuíba abrindo /discover sem query param
 *     UI  (CitySearchInput) → "Todas as cidades"   ← dizia que não havia filtro
 *     query                 → "Carapicuíba"        ← mas filtrava
 *     resultado             → 4 de 8 profissionais ← 4 escondidos sem aviso
 *
 * A raiz era uma COLISÃO SEMÂNTICA: "sem parâmetro na URL" significava ao mesmo
 * tempo "use a cidade do tutor" (para a query) e "não filtrar nada" (para o
 * select). Um único estado da URL não podia representar as duas intenções, e o
 * usuário não tinha como pedir de verdade "todas as cidades" — remover o filtro
 * simplesmente reinstalava o default.
 *
 * O contrato passa a ter TRÊS estados distintos e explícitos:
 *
 *   ausente          → default do perfil: filtra pela cidade do tutor
 *   "todas"          → intenção EXPLÍCITA de não filtrar
 *   qualquer cidade  → filtra por ela (override manual)
 *
 * Funções puras: sem IO, sem Next.js. A mesma função decide o valor do select
 * (client) e o filtro da query (server), o que torna impossível os dois
 * divergirem de novo.
 */

/**
 * Sentinela na URL para "não filtrar por cidade".
 *
 * Precisa ser um valor explícito, não a ausência do parâmetro: ausência já
 * significa "use o default do perfil". Em português para ficar legível na
 * barra de endereços, como o restante das rotas do produto.
 */
export const TODAS_AS_CIDADES = "todas"

export type DiscoveryCityResolution = {
  /**
   * Cidade que vai para a query. `undefined` = sem filtro de cidade.
   * É o valor que `findProfessionalsAction` recebe.
   */
  effectiveCity: string | undefined
  /**
   * Valor que o <select> deve exibir. Espelha exatamente o filtro em vigor —
   * nunca mostra "todas" quando há filtro ativo.
   */
  selectValue: string
  /** true quando o usuário pediu explicitamente para não filtrar. */
  semFiltroExplicito: boolean
  /** true quando o filtro em vigor veio do perfil, não de escolha manual. */
  usandoDefaultDoPerfil: boolean
}

/**
 * Resolve, a partir do parâmetro da URL e da cidade do perfil, qual cidade
 * filtra a busca E qual valor o seletor deve mostrar — sempre coerentes.
 */
export function resolveDiscoveryCity(params: {
  /** Valor cru de `?city=` (pode vir com espaços, ou ausente). */
  cityParam: string | null | undefined
  /** Cidade do perfil do tutor autenticado, quando houver. */
  tutorCity: string | null | undefined
}): DiscoveryCityResolution {
  const bruto = params.cityParam?.trim() ?? ""

  // Intenção explícita de ver tudo — precede o default do perfil.
  if (bruto === TODAS_AS_CIDADES) {
    return {
      effectiveCity: undefined,
      selectValue: TODAS_AS_CIDADES,
      semFiltroExplicito: true,
      usandoDefaultDoPerfil: false,
    }
  }

  // Override manual. Mesmo mínimo do schema da action (min 2), para não mandar
  // 1 caractere que o Zod rejeitaria silenciosamente adiante.
  if (bruto.length >= 2) {
    return {
      effectiveCity: bruto,
      selectValue: bruto,
      semFiltroExplicito: false,
      usandoDefaultDoPerfil: false,
    }
  }

  // Sem parâmetro utilizável → default do perfil.
  const doPerfil = params.tutorCity?.trim() || ""
  if (doPerfil.length > 0) {
    return {
      effectiveCity: doPerfil,
      selectValue: doPerfil,
      semFiltroExplicito: false,
      usandoDefaultDoPerfil: true,
    }
  }

  // Visitante sem perfil/sem cidade: nada a filtrar, e o select reflete isso.
  return {
    effectiveCity: undefined,
    selectValue: TODAS_AS_CIDADES,
    semFiltroExplicito: false,
    usandoDefaultDoPerfil: false,
  }
}
