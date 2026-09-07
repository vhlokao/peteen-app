/**
 * Extração SEMÂNTICA de constraints a partir do SQL das migrations — GATE-18 FIX-003.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NOME NÃO BASTA
 *
 * A versão anterior do effect-audit conferia apenas se o NOME da constraint
 * existia em `pg_constraint`. Isso responde "existe algo com esse nome?", não
 * "existe a constraint que a migration descreve?".
 *
 * A diferença não é teórica. Uma FK com o nome certo, apontando para a tabela
 * certa, mas com `ON DELETE NO ACTION` onde a migration pede `ON DELETE
 * CASCADE`, passa na conferência por nome — e muda o comportamento do banco na
 * hora em que uma linha pai é apagada. O mesmo vale para colunas trocadas numa
 * FK composta, ou para uma UNIQUE que virou PRIMARY KEY.
 *
 * Este módulo extrai os atributos que definem a constraint para que a
 * comparação seja sobre o que ela FAZ:
 *   tipo · tabela dona · colunas locais · tabela referenciada · colunas
 *   referenciadas · ON DELETE · ON UPDATE
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DUAS FORMAS SINTÁTICAS, O MESMO EFEITO
 *
 * As migrations deste repositório declaram constraints de dois jeitos:
 *
 *   ALTER TABLE "t" ADD CONSTRAINT "n" FOREIGN KEY (...) REFERENCES ...
 *   CREATE TABLE "t" ( ..., CONSTRAINT "n" PRIMARY KEY ("id") )
 *
 * A segunda estava invisível para o auditor anterior — que só olhava `ADD
 * CONSTRAINT` — e é justamente onde vivem TODAS as primary keys criadas pelas
 * migrations Prisma. Auditar só a primeira deixava as PKs sem verificação
 * nenhuma.
 */

/** Códigos de ação referencial do Postgres em `pg_constraint`. */
export const ACAO_POR_CODIGO = {
  a: "NO ACTION",
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET NULL",
  d: "SET DEFAULT",
}

/** `NO ACTION` é o default do SQL quando a cláusula é omitida. */
const ACAO_PADRAO = "NO ACTION"

const semAspas = (s) => String(s).replace(/"/g, "").trim()

/**
 * Percorre `texto` a partir de `inicio` (que aponta para uma aspa simples) e
 * devolve o índice logo APÓS o literal — respeitando `''` como aspa escapada.
 * Única implementação desse laço no arquivo; usada tanto pelo tokenizador
 * quanto por `parenExternoRedundante`, para que as duas nunca discordem sobre
 * onde um literal termina.
 */
function fimDoLiteral(texto, inicio) {
  let j = inicio + 1
  while (j < texto.length) {
    if (texto[j] === "'" && texto[j + 1] === "'") { j += 2; continue }
    if (texto[j] === "'") return j + 1
    j++
  }
  return texto.length
}

/**
 * A dupla de parênteses mais externa de `e` é REDUNDANTE — isto é, o primeiro
 * `(` fecha exatamente no último caractere?
 *
 * Isto é uma prova estrutural, não uma suposição: se o primeiro `(` só atinge
 * profundidade zero no último caractere da string, ele envolve a expressão
 * INTEIRA, e removê-lo nunca muda o agrupamento — ao contrário de remover um
 * parêntese qualquer, que pode.
 *
 * QUOTE-AWARE (GATE-18 FIX-006): um `(` ou `)` dentro de um literal
 * (`'assim (isto)'`) ou de um identificador citado (`"nome(estranho)"` — raro,
 * mas legal em SQL) NÃO é parêntese de agrupamento nenhum. A versão anterior
 * contava esses caracteres como se fossem, o que tanto podia impedir a
 * remoção de um parêntese externo genuinamente redundante quanto — pior —
 * fazer a contagem "fechar" num lugar errado dentro do literal.
 */
function parenExternoRedundante(e) {
  if (!e.startsWith("(") || !e.endsWith(")")) return false
  let profundidade = 0
  let i = 0
  while (i < e.length) {
    const c = e[i]
    if (c === "'") { i = fimDoLiteral(e, i); continue }
    if (c === '"') {
      const fim = e.indexOf('"', i + 1)
      i = fim === -1 ? e.length : fim + 1
      continue
    }
    if (c === "(") profundidade++
    else if (c === ")") {
      profundidade--
      if (profundidade === 0) return i === e.length - 1
    }
    i++
  }
  return false
}

/**
 * Normaliza uma expressão de CHECK para comparação — só o que é
 * COMPROVADAMENTE cosmético:
 *
 *   1. aspas de identificador removidas — SÓ quando comprovadamente seguro,
 *      ver `removerAspasSegura` abaixo;
 *   2. espaços em branco colapsados;
 *   3. parênteses externos redundantes, removidos um nível por vez, e só
 *      quando a prova acima confirma que são redundantes.
 *
 * NÃO normaliza: aspas simples (são literal de string, não identificador —
 * `'active'` e `active` são coisas DIFERENTES), maiúsculas/minúsculas de
 * identificador FORA da regra segura, nem casts que o Postgres injeta
 * (`(x)::integer`). Preferir um falso `CONTENT_CHECKSUM_DRIFT` — que só pede
 * revisão humana — a um falso `MATCH` que esconderia uma expressão
 * realmente diferente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG QUE ISTO CORRIGE (GATE-18 FIX-005)
 *
 * A versão anterior removia aspas de QUALQUER identificador, inclusive
 * `"userId"` → `userId`. Isso é inseguro: no Postgres, um identificador SEM
 * aspas é dobrado (fold) para minúsculas antes de resolver — `userId` sem
 * aspas resolve para a coluna `userid`. Um identificador COM aspas preserva o
 * case exato — `"userId"` resolve para a coluna `userId`. Se ambas existirem
 * como colunas distintas, `"userId"` e `userId` **não são a mesma coluna**, e
 * o normalizador antigo as tornava indistinguíveis: um CHECK real sobre
 * `"userId"` bateria, por engano, contra um CHECK sobre `userId`/`userid` de
 * outra coluna.
 *
 * A correção remove aspas apenas quando o nome citado já é inteiramente
 * minúsculo simples (`^[a-z_][a-z0-9_]*$`) — nesse caso, e SÓ nesse caso, a
 * prova é direta: a forma sem aspas dobraria para exatamente o mesmo nome, então
 * `"foo"` e `foo` resolvem para a MESMA coluna, sempre, sem depender de
 * contexto. Qualquer identificador com maiúscula mantém as aspas na forma
 * normalizada — o que faz `"userId"` continuar diferente de `userId` depois de
 * normalizado, e a comparação reprova corretamente.
 */
function removerAspasSegura(nomeCitado) {
  return /^[a-z_][a-z0-9_]*$/.test(nomeCitado)
}

/**
 * Divide a expressão em segmentos ANTES de normalizar qualquer coisa — é o que
 * torna as transformações seguras. Três tipos:
 *
 *   "literal"  → um literal de aspa simples, TEXTO ORIGINAL completo (com as
 *                aspas), nunca tocado depois disto;
 *   "ident"    → um identificador entre aspas duplas, guardado SEM as aspas —
 *                quem consome decide se re-cita, pela regra do FIX-005;
 *   "outro"    → qualquer outro trecho de SQL (operadores, palavras-chave,
 *                identificadores sem aspas, espaços) — o único tipo onde
 *                colapsar espaço em branco é seguro.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG QUE ISTO CORRIGE (GATE-18 FIX-006)
 *
 * A versão anterior já percorria a expressão caractere a caractere para
 * preservar literais e decidir a aspa do identificador — mas devolvia tudo
 * concatenado numa ÚNICA string, e só DEPOIS rodava
 * `saida.trim().replace(/\s+/g, " ")` sobre o resultado inteiro. Esse
 * `replace` não sabe que parte da string é literal: ele recolapsava espaço em
 * branco QUE JÁ ESTAVA DENTRO do literal preservado.
 *
 *   status = 'a  b'   (dois espaços, dentro do valor)
 *   status = 'a b'    (um espaço)
 *
 * são expressões DIFERENTES — mas as duas normalizavam para
 * `status = 'a b'`. Tokenizar primeiro e colapsar espaço só no segmento
 * "outro" elimina a possibilidade estrutural desse erro: o texto de um
 * segmento "literal" nunca passa por `.replace(/\s+/g, " ")` em lugar nenhum
 * do código.
 */
function tokenizarExpressao(expr) {
  const tokens = []
  let outro = ""
  const fecharOutro = () => {
    if (outro) tokens.push({ tipo: "outro", texto: outro })
    outro = ""
  }

  let i = 0
  while (i < expr.length) {
    const c = expr[i]

    if (c === "'") {
      fecharOutro()
      const fim = fimDoLiteral(expr, i)
      tokens.push({ tipo: "literal", texto: expr.slice(i, fim) })
      i = fim
      continue
    }

    if (c === '"') {
      fecharOutro()
      const fim = expr.indexOf('"', i + 1)
      if (fim === -1) {
        // Aspa sem par: não há identificador para fechar — preserva o resto
        // como texto comum em vez de inventar um limite que não existe.
        tokens.push({ tipo: "outro", texto: expr.slice(i) })
        i = expr.length
        break
      }
      tokens.push({ tipo: "ident", texto: expr.slice(i + 1, fim) })
      i = fim + 1
      continue
    }

    outro += c
    i++
  }
  fecharOutro()
  return tokens
}

export function normalizarExpressao(expr) {
  const saida = tokenizarExpressao(expr)
    .map((t) => {
      if (t.tipo === "literal") return t.texto // intocado — nem espaço, nem mais nada
      if (t.tipo === "ident") return removerAspasSegura(t.texto) ? t.texto : `"${t.texto}"`
      return t.texto.replace(/\s+/g, " ") // só aqui é seguro colapsar espaço
    })
    .join("")
    .trim()

  return desfazerParenExternoRedundante(saida)
}

/** Remove parênteses externos redundantes, um nível por vez — ver a prova em `parenExternoRedundante`. */
function desfazerParenExternoRedundante(e) {
  let saida = e
  while (parenExternoRedundante(saida)) saida = saida.slice(1, -1).trim()
  return saida
}

/**
 * Extrai e normaliza a expressão de dentro de `CHECK (...)` — usada tanto no
 * SQL da migration quanto em `pg_get_constraintdef()`, que devolve
 * exatamente essa forma (`CHECK (<expressão>)`) para constraints do tipo `c`.
 * Uma única função dos dois lados garante que repo e banco recebem a MESMA
 * normalização — comparar com regras diferentes de cada lado seria pior do
 * que não normalizar.
 */
export function expressaoDoCheck(textoComCheck) {
  const m = String(textoComCheck).trim().match(/^CHECK\s*\(([\s\S]*)\)$/i)
  if (!m) return null
  return normalizarExpressao(m[1])
}

/** `("a", "b")` → `["a","b"]`, preservando a ordem — que importa em FK composta. */
function listaDeColunas(texto) {
  if (!texto) return []
  return texto
    .split(",")
    .map((c) => semAspas(c))
    .filter(Boolean)
}

/**
 * Divide o SQL em statements por `;`, ignorando `;` dentro de string literal.
 * Blocos `DO $$ ... $$` são deixados inteiros: eles não declaram constraint
 * nomeada neste repositório e fatiá-los produziria lixo.
 */
export function statementsDe(sql) {
  const partes = []
  let atual = ""
  let emString = false
  let emDollar = false

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (sql.startsWith("$$", i)) {
      emDollar = !emDollar
      atual += "$$"
      i++
      continue
    }
    if (c === "'" && !emDollar) emString = !emString
    if (c === ";" && !emString && !emDollar) {
      partes.push(atual)
      atual = ""
      continue
    }
    atual += c
  }
  if (atual.trim()) partes.push(atual)
  return partes.map((p) => p.trim()).filter(Boolean)
}

/**
 * Lê o corpo de uma constraint a partir de `inicio`, parando na vírgula de
 * NÍVEL ZERO de parênteses (ou no fim do texto).
 *
 * Isto precisa ser um scanner, não um regex com lookahead: em
 * `CONSTRAINT "x" UNIQUE ("a", "b")` existe uma vírgula DENTRO dos parênteses,
 * e um lookahead ingênuo corta ali — produzindo `UNIQUE ("a"`, que não casa com
 * nada e some do inventário sem erro nenhum. Foi exatamente esse o bug: a
 * UNIQUE composta desaparecia em silêncio enquanto PK e CHECK apareciam,
 * dando a impressão de que o parser funcionava.
 */
function corpoAte(texto, inicio) {
  let profundidade = 0
  let emString = false
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (c === "'") emString = !emString
    if (emString) continue
    if (c === "(") profundidade++
    else if (c === ")") profundidade--
    else if (c === "," && profundidade === 0) return texto.slice(inicio, i)
  }
  return texto.slice(inicio)
}

/** Percorre todas as ocorrências de `CONSTRAINT <nome>` e lê o corpo de cada uma. */
function constraintsNoTexto(texto, tabela, exigirAdd) {
  const encontradas = []
  const re = exigirAdd
    ? /ADD CONSTRAINT\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s+/gi
    : /CONSTRAINT\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s+/gi

  for (const m of texto.matchAll(re)) {
    const corpo = corpoAte(texto, m.index + m[0].length)
    const desc = descreverCorpo(corpo)
    if (desc) encontradas.push({ nome: m[1], tabela, ...desc })
  }
  return encontradas
}

/**
 * Constraints declaradas via `ALTER TABLE ... ADD CONSTRAINT`.
 *
 * Um `DROP CONSTRAINT IF EXISTS` seguido de `ADD CONSTRAINT` — o padrão de
 * idempotência deste repositório — produz UMA constraint esperada, pelo ADD:
 * o efeito ao final do statement é a constraint existir.
 */
function daAlterTable(stmt) {
  const tabela = stmt.match(/ALTER TABLE(?:\s+IF EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/i)
  if (!tabela) return []
  return constraintsNoTexto(stmt, semAspas(tabela[1]), true)
}

/**
 * Constraints nomeadas INLINE dentro de `CREATE TABLE`.
 * É onde estão as primary keys geradas pelo Prisma.
 */
function daCreateTable(stmt) {
  const m = stmt.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(([\s\S]*)\)/i)
  if (!m) return []
  return constraintsNoTexto(m[2], semAspas(m[1]), false)
}

/** Interpreta o corpo de uma constraint (a parte depois do nome). */
function descreverCorpo(corpo) {
  const texto = corpo.trim()

  const fk = texto.match(
    /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(([^)]*)\)([\s\S]*)/i
  )
  if (fk) {
    const cauda = fk[4] ?? ""
    const onDelete = cauda.match(/ON DELETE\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)/i)
    const onUpdate = cauda.match(/ON UPDATE\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)/i)
    return {
      tipo: "FOREIGN KEY",
      colunas: listaDeColunas(fk[1]),
      tabelaReferenciada: semAspas(fk[2]),
      colunasReferenciadas: listaDeColunas(fk[3]),
      onDelete: onDelete ? onDelete[1].toUpperCase() : ACAO_PADRAO,
      onUpdate: onUpdate ? onUpdate[1].toUpperCase() : ACAO_PADRAO,
    }
  }

  const pk = texto.match(/PRIMARY KEY\s*\(([^)]*)\)/i)
  if (pk) return { tipo: "PRIMARY KEY", colunas: listaDeColunas(pk[1]) }

  const uq = texto.match(/^UNIQUE\s*\(([^)]*)\)/i)
  if (uq) return { tipo: "UNIQUE", colunas: listaDeColunas(uq[1]) }

  if (/^CHECK\s*\(/i.test(texto)) return { tipo: "CHECK", colunas: [], expressao: expressaoDoCheck(texto) }

  return null
}

/** Todas as constraints que um arquivo de migration declara. */
export function constraintsDe(sql) {
  const encontradas = []
  for (const stmt of statementsDe(sql)) {
    encontradas.push(...daAlterTable(stmt), ...daCreateTable(stmt))
  }
  // Dedup por nome mantendo a primeira descrição completa.
  const porNome = new Map()
  for (const c of encontradas) if (!porNome.has(c.nome)) porNome.set(c.nome, c)
  return [...porNome.values()]
}

/**
 * Compara o que a migration declara com o que o banco tem.
 *
 * Devolve a lista de divergências. Vazio = a constraint existe E faz a mesma
 * coisa. `null` em `real` significa que ela não existe — e isso é uma
 * divergência só, não sete.
 */
export function compararConstraint(esperada, real) {
  if (!real) return ["ausente no banco"]

  const dif = []
  const igualLista = (a, b) =>
    (a ?? []).length === (b ?? []).length && (a ?? []).every((x, i) => x === (b ?? [])[i])

  if (esperada.tipo !== real.tipo) dif.push(`tipo: esperado ${esperada.tipo}, real ${real.tipo}`)
  if (esperada.tabela !== real.tabela) dif.push(`tabela: esperada ${esperada.tabela}, real ${real.tabela}`)

  if (!igualLista(esperada.colunas, real.colunas)) {
    dif.push(`colunas: esperadas (${(esperada.colunas ?? []).join(", ")}), reais (${(real.colunas ?? []).join(", ")})`)
  }

  if (esperada.tipo === "FOREIGN KEY") {
    if (esperada.tabelaReferenciada !== real.tabelaReferenciada) {
      dif.push(`referencia: esperada ${esperada.tabelaReferenciada}, real ${real.tabelaReferenciada}`)
    }
    if (!igualLista(esperada.colunasReferenciadas, real.colunasReferenciadas)) {
      dif.push(
        `colunas referenciadas: esperadas (${(esperada.colunasReferenciadas ?? []).join(", ")}), ` +
          `reais (${(real.colunasReferenciadas ?? []).join(", ")})`
      )
    }
    if (esperada.onDelete !== real.onDelete) dif.push(`ON DELETE: esperado ${esperada.onDelete}, real ${real.onDelete}`)
    if (esperada.onUpdate !== real.onUpdate) dif.push(`ON UPDATE: esperado ${esperada.onUpdate}, real ${real.onUpdate}`)
  }

  if (esperada.tipo === "CHECK") {
    // A expressão JÁ carrega a coluna e a condição — comparar como texto
    // normalizado cobre "coluna diferente" e "limite diferente" ao mesmo
    // tempo, sem precisar entender a sintaxe da expressão booleana.
    if (esperada.expressao !== real.expressao) {
      dif.push(`expressão CHECK: esperada (${esperada.expressao}), real (${real.expressao})`)
    }
  }

  return dif
}
