/**
 * Módulo: growth-engine
 * Camada: domain — indisponibilidade técnica NÃO é dado de negócio
 * (GATE-15-LOCATION-DISCOVERY-GROWTH-TRUTH-FIX-002).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO IMPEDE
 *
 * Os modelos territoriais (`Region`, `Neighborhood`) podem não existir no
 * Prisma Client — client gerado antes de eles entrarem no schema, ou
 * `prisma generate` não rodado depois de um pull. Quando isso acontecia, as
 * leituras do Growth devolviam `0` e `[]`, e `/admin/growth` desenhava:
 *
 *   "Regiões cadastradas: 0"
 *   "Bairros cadastrados: 0"
 *   "Nenhuma região cadastrada."
 *
 * Três afirmações sobre o território, todas produzidas por uma falha de build.
 * A origem é diferente da do banco fora do ar, mas para quem lê a tela a
 * mentira é a mesma — e é a mesma classe que o GATE-15-001 tinha acabado de
 * proibir nos catches de banco.
 *
 * O agravante registrado: o RESULT do GATE-15-001 defendeu este caminho
 * dizendo que "a UI já comunica isso em separado". Ela não comunicava. A
 * afirmação não foi verificada e virou teste, congelando a suposição como
 * contrato.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A DISTINÇÃO QUE PRECISA SOBREVIVER
 *
 *   delegate AUSENTE  → falha técnica  → LANÇA (sobe para a fronteira de erro)
 *   delegate PRESENTE
 *     e nenhuma linha → fato de negócio → `0` / `[]` legítimos
 *
 * Só o primeiro caso passa por aqui. O segundo continua sendo resposta normal
 * das queries — e há teste separando os dois, porque colapsá-los é justamente
 * o defeito.
 *
 * Puro de propósito: recebe o delegate já resolvido, não toca em `prisma`. É o
 * que permite exercer o comportamento (lança vs devolve) sem banco.
 */

export const GROWTH_DELEGATE_UNAVAILABLE =
  "Módulo Growth Engine indisponível no Prisma Client. Execute `npx prisma generate` e reinicie o servidor (npm run dev)."

/**
 * Erro de INDISPONIBILIDADE, não de dados.
 *
 * Classe própria para que a fronteira de erro — e qualquer triagem futura —
 * consiga distinguir "o client não conhece o modelo" de "a query falhou".
 */
export class GrowthDelegateUnavailableError extends Error {
  /** Qual modelo faltava. Técnico, sem PII. */
  readonly modelo: string

  constructor(modelo: string) {
    super(`${GROWTH_DELEGATE_UNAVAILABLE} (modelo ausente: ${modelo})`)
    this.name = "GrowthDelegateUnavailableError"
    this.modelo = modelo
  }
}

/**
 * Devolve o delegate ou lança.
 *
 * NUNCA devolve `null`, `undefined` ou um substituto vazio: um chamador que
 * recebesse "nada" voltaria a ter como transformar isso em zero, que é o
 * comportamento que este módulo existe para tornar impossível.
 */
export function exigirDelegate<T>(delegate: T | null | undefined, modelo: string): T {
  if (delegate === null || delegate === undefined) {
    throw new GrowthDelegateUnavailableError(modelo)
  }
  return delegate
}
