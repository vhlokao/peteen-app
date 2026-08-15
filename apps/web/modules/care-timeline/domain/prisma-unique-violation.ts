/**
 * Identificação de QUAL constraint única foi violada num erro P2002 do Prisma.
 *
 * Módulo puro e sem imports de runtime — de propósito. Esta lógica já falhou
 * uma vez de forma silenciosa e precisa de teste unitário próprio; enquanto
 * vivia dentro do repository (que importa o Prisma Client) não havia como
 * testá-la sem banco.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É MAIS COMPLICADO DO QUE DEVERIA
 *
 * A forma do erro P2002 depende do DRIVER. Com `@prisma/adapter-pg` — o que
 * este projeto usa — `meta.target` vem UNDEFINED, e a informação real fica em:
 *
 *   meta.driverAdapterError.cause.constraint.fields  → ['"requestId"', '"idempotencyKey"']
 *   meta.driverAdapterError.cause.constraint.index   → nome do índice
 *   meta.driverAdapterError.cause.originalMessage    → 'duplicate key ... "care_updates_requestId_idempotencyKey_key"'
 *
 * (forma capturada do banco real; `meta.target` só aparece no driver nativo)
 *
 * ATENÇÃO AO COMPARAR: os três formatos devolvem coisas de granularidade
 * diferente. `fields` traz nomes de COLUNA exatos; `index` e `originalMessage`
 * trazem strings que CONTÊM o nome da coluna dentro de um nome maior
 * (`care_updates_requestId_idempotencyKey_key`). Por isso o consumidor precisa
 * comparar por SUBSTRING — `Array.includes`, que é igualdade exata, faz os dois
 * últimos formatos nunca casarem. Foi exatamente esse o defeito encontrado na
 * revisão: os fallbacks existiam no papel e eram código morto.
 * `matchesUniqueConstraint` abaixo existe para que ninguém precise lembrar disso.
 */

/** Erro genérico o bastante para não depender do tipo do Prisma Client. */
type PossivelErroPrisma = {
  code?: unknown
  meta?: {
    target?: unknown
    driverAdapterError?: {
      cause?: {
        originalMessage?: unknown
        constraint?: { fields?: unknown; index?: unknown }
      }
    }
  }
}

/**
 * Nomes associados a um P2002 — colunas, nome do índice e/ou a mensagem crua.
 * Devolve `null` quando o erro NÃO é P2002 (nunca array vazio, para que
 * "não é P2002" e "é P2002 sem detalhe" sejam distinguíveis).
 */
export function uniqueViolationTarget(err: unknown): string[] | null {
  if (typeof err !== "object" || err === null) return null
  const e = err as PossivelErroPrisma
  if (e.code !== "P2002") return null

  const meta = e.meta
  const nomes: string[] = []
  const limpar = (v: unknown) => String(v).replace(/"/g, "")

  // 1. Driver nativo.
  if (Array.isArray(meta?.target)) nomes.push(...meta.target.map(limpar))
  else if (typeof meta?.target === "string") nomes.push(limpar(meta.target))

  // 2. adapter-pg: colunas e nome do índice.
  const causa = meta?.driverAdapterError?.cause
  const fields = causa?.constraint?.fields
  if (Array.isArray(fields)) nomes.push(...fields.map(limpar))
  if (causa?.constraint?.index) nomes.push(limpar(causa.constraint.index))

  // 3. Último recurso: a mensagem carrega o nome da constraint.
  if (typeof causa?.originalMessage === "string") nomes.push(limpar(causa.originalMessage))

  return nomes
}

/**
 * A constraint violada envolve esta coluna?
 *
 * Comparação por SUBSTRING, não por igualdade: ver o bloco no topo do arquivo.
 * Sem isto, `constraint.index` e `originalMessage` seriam inúteis.
 */
export function matchesUniqueConstraint(nomes: string[], coluna: string): boolean {
  return nomes.some((n) => n.includes(coluna))
}
