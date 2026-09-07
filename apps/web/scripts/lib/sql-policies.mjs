/**
 * Extração SEMÂNTICA de RLS policies a partir do SQL das migrations — GATE-18 FIX-018.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE MÓDULO EXISTE
 *
 * O auditor conferia policy só pelo NOME, e só contra `storage.objects`. Dois
 * defeitos numa linha só:
 *
 *   1. as 29 policies de `public` da migration de segurança da Fase A eram
 *      invisíveis para ele — existiam no banco e apareciam como faltando;
 *   2. mesmo para storage, "existe algo com esse nome?" não é a pergunta certa.
 *
 * O FIX-003 já tinha aprendido isso para constraints: uma FK com o nome certo e
 * `ON DELETE` diferente passava na conferência e mudava o comportamento do
 * banco. A lição não tinha sido aplicada às policies — e numa policy o corpo é
 * literalmente a regra de acesso. Nome igual com `USING` diferente é a
 * diferença entre "cada um vê o seu" e "todo mundo vê tudo".
 *
 * Aqui a identidade é (schema, tabela, nome) e a comparação é sobre o que a
 * policy FAZ: comando · papéis · USING · WITH CHECK.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMO O TEXTO É LIDO
 *
 * Estrutura é localizada no SQL MASCARADO (`mascararLiterais`), onde o conteúdo
 * de literais virou espaço — assim `CREATE POLICY` nunca é encontrado dentro de
 * uma string. Os VALORES são lidos do texto original nas mesmas posições, porque
 * o corpo de uma policy é feito de literais que precisam ser lidos de verdade
 * (`bucket_id = 'avatars'`). O mascaramento preserva o comprimento justamente
 * para que os dois índices coincidam.
 */

import { mascararLiterais, fimDoIdentificadorCitado, normalizarExpressao } from "./sql-constraints.mjs"

const COMANDOS = ["ALL", "SELECT", "INSERT", "UPDATE", "DELETE"]

/** Schema assumido quando a migration escreve a tabela sem qualificar. */
export const SCHEMA_PADRAO = "public"

/**
 * Lê um identificador SQL em `mascarado` a partir de `i`, pulando espaços
 * antes. Devolve `{ nome, fim }` ou `null`.
 *
 * Citado (`"Foo"`) preserva caixa e vira o nome sem as aspas, com `""`
 * desescapado para `"`. Sem aspas, o Postgres dobra para minúsculas — e é isso
 * que `pg_policies` devolve, então dobrar aqui é o que faz os dois lados
 * comparáveis.
 */
function lerIdentificador(mascarado, original, i) {
  while (i < mascarado.length && /\s/.test(mascarado[i])) i++
  if (i >= mascarado.length) return null
  if (mascarado[i] === '"') {
    const fim = fimDoIdentificadorCitado(mascarado, i)
    if (fim === -1) return null
    return { nome: original.slice(i + 1, fim - 1).replace(/""/g, '"'), fim }
  }
  const m = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(mascarado.slice(i))
  if (!m) return null
  return { nome: m[0].toLowerCase(), fim: i + m[0].length }
}

/**
 * A partir do `(` em `i`, devolve `{ expressao, fim }` com o conteúdo entre os
 * parênteses balanceados, lido do texto ORIGINAL.
 *
 * A contagem roda sobre o mascarado, então um `)` dentro de um literal
 * (`'oi :)'`) não fecha nada — o mesmo cuidado que o FIX-006 exigiu em
 * `parenExternoRedundante`.
 */
function lerParenteses(mascarado, original, i) {
  while (i < mascarado.length && /\s/.test(mascarado[i])) i++
  if (mascarado[i] !== "(") return null
  let profundidade = 0
  for (let j = i; j < mascarado.length; j++) {
    if (mascarado[j] === "(") profundidade++
    else if (mascarado[j] === ")") {
      profundidade--
      if (profundidade === 0) return { expressao: original.slice(i + 1, j), fim: j + 1 }
    }
  }
  return null
}

/** Casa `re` exatamente na posição `i` (após espaços) e devolve `{ m, fim }`. */
function casarAqui(mascarado, i, re) {
  while (i < mascarado.length && /\s/.test(mascarado[i])) i++
  const m = re.exec(mascarado.slice(i))
  return m ? { m, fim: i + m[0].length } : null
}

/**
 * Todas as policies declaradas em `sql`, com semântica.
 *
 * `CREATE POLICY` é localizado apenas fora de literais. `DROP POLICY` é
 * ignorado de propósito: o que interessa auditar é o estado que a migration
 * DECLARA, e um `DROP ... IF EXISTS` seguido de `CREATE` (o padrão idempotente
 * usado nas migrations de segurança) declara exatamente a policy do `CREATE`.
 */
export function policiesDe(sql) {
  const mascarado = mascararLiterais(sql)
  const achadas = []

  for (const m of mascarado.matchAll(/\bCREATE\s+POLICY\b/gi)) {
    let i = m.index + m[0].length

    const nome = lerIdentificador(mascarado, sql, i)
    if (!nome) continue
    i = nome.fim

    const on = casarAqui(mascarado, i, /^ON\b/i)
    if (!on) continue
    i = on.fim

    const primeiro = lerIdentificador(mascarado, sql, i)
    if (!primeiro) continue
    i = primeiro.fim

    // schema.tabela ou só tabela
    let schema = SCHEMA_PADRAO
    let tabela = primeiro.nome
    const ponto = casarAqui(mascarado, i, /^\./)
    if (ponto) {
      const segundo = lerIdentificador(mascarado, sql, ponto.fim)
      if (segundo) { schema = primeiro.nome; tabela = segundo.nome; i = segundo.fim }
    }

    // AS PERMISSIVE | RESTRICTIVE (opcional; default PERMISSIVE)
    let permissiva = "PERMISSIVE"
    const as = casarAqui(mascarado, i, /^AS\s+(PERMISSIVE|RESTRICTIVE)\b/i)
    if (as) { permissiva = as.m[1].toUpperCase(); i = as.fim }

    // FOR <comando> (opcional; default ALL)
    let comando = "ALL"
    const forr = casarAqui(mascarado, i, new RegExp(`^FOR\\s+(${COMANDOS.join("|")})\\b`, "i"))
    if (forr) { comando = forr.m[1].toUpperCase(); i = forr.fim }

    // TO <papéis> (opcional; default PUBLIC)
    let papeis = ["public"]
    const to = casarAqui(mascarado, i, /^TO\s+([^;()]*?)(?=\s+USING\b|\s+WITH\s+CHECK\b|\s*;|\s*$)/i)
    if (to) {
      papeis = to.m[1].split(",").map((p) => p.trim().replace(/^"|"$/g, "").toLowerCase()).filter(Boolean)
      i = to.fim
    }

    let usando = null
    const using = casarAqui(mascarado, i, /^USING\b/i)
    if (using) {
      const exp = lerParenteses(mascarado, sql, using.fim)
      if (exp) { usando = exp.expressao; i = exp.fim }
    }

    let comCheck = null
    const wc = casarAqui(mascarado, i, /^WITH\s+CHECK\b/i)
    if (wc) {
      const exp = lerParenteses(mascarado, sql, wc.fim)
      if (exp) { comCheck = exp.expressao; i = exp.fim }
    }

    achadas.push({ schema, tabela, nome: nome.nome, permissiva, comando, papeis, usando, comCheck })
  }
  return achadas
}

/** Chave de identidade — nome sozinho não identifica policy. */
export const chaveDaPolicy = (p) => `${p.schema}.${p.tabela}."${p.nome}"`

/** Igualdade de expressão sob a normalização já testada do FIX-005/006/007. */
function mesmaExpressao(a, b) {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return normalizarExpressao(a) === normalizarExpressao(b)
}

/**
 * Diferenças entre a policy que a migration declara e a que o banco tem.
 * Lista vazia = equivalentes. `real === null` = ausente no banco.
 *
 * LIMITAÇÃO DECLARADA: a comparação de expressão é textual sob normalização de
 * espaços — ela NÃO sabe que `'avatars'` e `'avatars'::text` são a mesma coisa,
 * porque o Postgres devolve a forma já com cast explícito enquanto uma migration
 * escrita à mão costuma omiti-lo. Isso produz `USING difere` em casos
 * semanticamente equivalentes.
 *
 * É deliberado, e a direção do erro é a que importa: acusar diferença que não
 * existe custa uma conferência humana; deixar passar uma que existe custa a
 * regra de acesso. Ensinar o normalizador a apagar casts seria "fazer ficar
 * verde por normalização adicional" — exatamente o que o VERIFY-008 proibiu.
 */
export function compararPolicy(esperada, real) {
  if (!real) return ["ausente"]
  const dif = []
  if (esperada.comando !== real.comando) dif.push(`comando ${esperada.comando} != ${real.comando}`)

  const pe = [...esperada.papeis].sort().join(",")
  const pr = [...real.papeis].sort().join(",")
  if (pe !== pr) dif.push(`papéis ${pe || "(nenhum)"} != ${pr || "(nenhum)"}`)

  if (esperada.permissiva !== real.permissiva) dif.push(`${esperada.permissiva} != ${real.permissiva}`)
  if (!mesmaExpressao(esperada.usando, real.usando)) dif.push("USING difere")
  if (!mesmaExpressao(esperada.comCheck, real.comCheck)) dif.push("WITH CHECK difere")
  return dif
}
