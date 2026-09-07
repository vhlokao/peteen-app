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
 * Percorre `texto` a partir de `inicio` (que aponta para a aspa dupla de
 * abertura) e devolve o índice logo APÓS a aspa de fechamento — respeitando
 * `""` como aspa dupla ESCAPADA dentro do identificador, exatamente como o
 * Postgres exige (`"a""b"` é o identificador de nome `a"b`, uma coisa só).
 * Devolve `-1` se não houver fechamento (aspa órfã) — mesma convenção de
 * `String.indexOf`.
 *
 * Única implementação deste laço no arquivo. É a correção de um bug real do
 * GATE-18 FIX-007: `tokenizarExpressao` e `parenExternoRedundante` reimplementavam
 * essa busca cada um com `indexOf('"', i + 1)`, que trata a PRIMEIRA aspa de
 * um par `""` como fechamento — `"a""b"` era lido como DOIS identificadores
 * (`a` e `b`) em vez de um (`a"b`), e ambos podiam acabar sem aspa na forma
 * normalizada, produzindo `ab` — que passaria, por engano, contra um
 * identificador genuinamente diferente de mesmo nome.
 */
export function fimDoIdentificadorCitado(texto, inicio) {
  let j = inicio + 1
  while (j < texto.length) {
    if (texto[j] === '"' && texto[j + 1] === '"') { j += 2; continue }
    if (texto[j] === '"') return j + 1
    j++
  }
  return -1
}

/**
 * Devolve `sql` com o CONTEÚDO de literais e de blocos dollar-quoted trocado
 * por espaços, preservando o comprimento e as aspas/tags delimitadoras.
 *
 * Para que serve: buscar palavras-chave SQL com regex sem cair dentro de texto
 * que só *parece* SQL. É a correção do GATE-18 FIX-018 (BUG 2): o auditor lia
 *
 *   WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
 *
 * e inventava uma tabela chamada `AS`, porque o regex de `CREATE TABLE` não
 * sabia distinguir código de string. Mascarar antes de buscar resolve a classe
 * inteira do problema, em vez de remendar aquele caso.
 *
 * Comprimento preservado de propósito: os índices do texto mascarado continuam
 * apontando para as mesmas posições do texto original, então dá para LOCALIZAR
 * no mascarado e LER no original — necessário para `CREATE POLICY`, cujo corpo
 * é feito de literais que precisam ser lidos de verdade.
 *
 * Identificadores citados (`"Foo"`) NÃO são mascarados: são nomes de objeto,
 * exatamente o que se quer capturar. Comentários não são tratados aqui —
 * `semComentarios` já os remove antes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BLOCOS DOLLAR-QUOTED NÃO SÃO MASCARADOS — e isso é deliberado.
 *
 * A primeira versão deste fix mascarava `$$ … $$` junto com os literais. Parecia
 * mais seguro e era pior: as migrations deste repositório declaram enums pelo
 * padrão idempotente
 *
 *   DO $$ BEGIN
 *     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CareMediaType') THEN
 *       CREATE TYPE "CareMediaType" AS ENUM ('PHOTO');
 *     END IF;
 *   END $$;
 *
 * e mascarar o bloco apagava um `CREATE TYPE` REAL. O auditor passou a reportar
 * `care_media_v0` como 7/7 em vez de 8/8, perdendo o enum em silêncio — perder
 * detecção de objeto real é exatamente o que este fix não pode fazer.
 *
 * Num bloco `DO`, o conteúdo é DDL que executa na hora da migration: é código,
 * não texto. Os literais lá dentro continuam sendo mascarados normalmente, que
 * é o comportamento correto.
 *
 * LIMITAÇÃO CONHECIDA E ACEITA: dollar quoting também serve para carregar DADOS
 * (`SELECT $$it's fine$$`). Uma apóstrofe ímpar aí dentro faria o scanner de
 * literais dessincronizar e mascarar demais. Nenhuma migration deste repositório
 * usa dollar quoting assim, e a direção do erro é conservadora — mascarar demais
 * faz o auditor ACUSAR ausência, nunca aprovar drift.
 */
export function mascararLiterais(sql) {
  let saida = ""
  let i = 0
  while (i < sql.length) {
    const c = sql[i]
    if (c === "'") {
      const fim = fimDoLiteral(sql, i)
      const bruto = sql.slice(i, fim)
      // mantém as aspas das pontas; o miolo vira espaço
      saida += bruto.length >= 2
        ? "'" + " ".repeat(bruto.length - 2) + (bruto.endsWith("'") ? "'" : " ")
        : " ".repeat(bruto.length)
      i = fim
      continue
    }
    if (c === '"') {
      const fim = fimDoIdentificadorCitado(sql, i)
      if (fim === -1) { saida += sql.slice(i); break }
      saida += sql.slice(i, fim)   // identificador preservado
      i = fim
      continue
    }
    saida += c
    i++
  }
  return saida
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
      const fim = fimDoIdentificadorCitado(e, i)
      i = fim === -1 ? e.length : fim
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
 *   1. espaços em branco colapsados, e SÓ fora de literal/identificador citado;
 *   2. parênteses externos redundantes, removidos um nível por vez, e só
 *      quando a prova estrutural confirma que são redundantes.
 *
 * NÃO normaliza: aspas simples (são literal de string, não identificador —
 * `'active'` e `active` são coisas DIFERENTES), **aspas de identificador, em
 * nenhum caso** (ver "Política final" abaixo), nem casts que o Postgres injeta
 * (`(x)::integer`). Preferir um falso `CONTENT_CHECKSUM_DRIFT` — que só pede
 * revisão humana — a um falso `MATCH` que esconderia uma expressão
 * realmente diferente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POLÍTICA FINAL DE IDENTIFICADOR CITADO (GATE-18 FIX-007)
 *
 * Este módulo passou por duas tentativas de "remover aspa quando é seguro", e
 * as DUAS esconderam um jeito de a mesma pergunta dar errado:
 *
 *   FIX-004  removia aspa de QUALQUER identificador citado. `"userId"` virava
 *            `userId` — mas sem aspas o Postgres dobra (fold) para
 *            minúsculas, resolvendo para `userid`. Coluna potencialmente
 *            diferente, tratada como igual.
 *
 *   FIX-005  restringiu a remoção a identificador já minúsculo simples
 *            (`^[a-z_][a-z0-9_]*$`), com a prova de que o fold não mudaria o
 *            texto. A prova está certa sobre TEXTO — e errada sobre
 *            SIGNIFICADO: `null` e `true` são minúsculos simples e NÃO SÃO
 *            IDENTIFICADOR NENHUM sem aspas — são o literal NULL e o literal
 *            booleano da linguagem. `"null" IS NOT NULL` testa uma coluna
 *            chamada `null`; `null IS NOT NULL` testa o literal NULL contra
 *            NULL, e é sempre falso. Removê-la trocou uma pergunta sobre dado
 *            por uma pergunta sobre a linguagem.
 *
 * Provar essa distinção corretamente exigiria conhecer toda a gramática de
 * palavras reservadas da versão exata do Postgres em uso — e uma lista
 * caseira de keywords estaria sempre incompleta (a lista muda entre versões,
 * e a mesma palavra pode ser reservada num contexto e não noutro).
 *
 * **A política final: NUNCA remover aspa de identificador citado.** Um
 * identificador citado permanece citado, sempre, na forma normalizada — sem
 * exceção para lowercase simples. O preço é aceito às claras: `"foo"` (citado)
 * e `foo` (sem aspas) podem ser a MESMA coluna e ainda assim o comparador
 * relatar um drift — falso negativo conservador. É o troca certo: entre
 * marcar como diferente algo que é igual (pede revisão humana, nunca
 * corrompe nada) e marcar como igual algo que é diferente (esconde o problema
 * que esta ferramenta existe para achar), só o primeiro é aceitável.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TRÊS TIPOS DE SEGMENTO
 *
 * A expressão é dividida em segmentos ANTES de normalizar qualquer coisa — é
 * o que torna as transformações seguras:
 *
 *   "literal"  → um literal de aspa simples, TEXTO ORIGINAL completo (com as
 *                aspas), nunca tocado depois disto;
 *   "ident"    → um identificador entre aspas duplas, TEXTO ORIGINAL completo
 *                (com as aspas), nunca tocado — ver a política acima;
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
      const fim = fimDoIdentificadorCitado(expr, i)
      if (fim === -1) {
        // Aspa sem par: não há identificador para fechar — preserva o resto
        // como texto comum em vez de inventar um limite que não existe.
        tokens.push({ tipo: "outro", texto: expr.slice(i) })
        i = expr.length
        break
      }
      // Texto ORIGINAL completo, aspas e tudo — a política final nunca as remove.
      tokens.push({ tipo: "ident", texto: expr.slice(i, fim) })
      i = fim
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
      // "literal" e "ident" saem exatamente como entraram — ver "Política
      // final de identificador citado" acima para o porquê de "ident" nunca
      // perder a aspa, em nenhum caso.
      if (t.tipo === "literal" || t.tipo === "ident") return t.texto
      return t.texto.replace(/\s+/g, " ") // só "outro" pode colapsar espaço
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
