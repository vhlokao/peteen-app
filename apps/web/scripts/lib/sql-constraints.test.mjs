/**
 * GATE-18 FIX-003 — extração e comparação SEMÂNTICA de constraints.
 *
 * O que estes testes protegem: a versão anterior do effect-audit conferia só o
 * NOME da constraint. Uma FK apontando para a tabela certa mas com
 * `ON DELETE NO ACTION` onde a migration pede `CASCADE` passava na conferência
 * — e muda o comportamento do banco quando uma linha pai é apagada.
 *
 * Cada bloco abaixo tem controle negativo: não basta o caso bom passar, o caso
 * ruim precisa REPROVAR. Sem isso, um comparador que devolve `[]` sempre
 * passaria em tudo.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { constraintsDe, compararConstraint, statementsDe, expressaoDoCheck, normalizarExpressao } from "./sql-constraints.mjs"

// Sintaxe real, copiada das migrations deste repositório.
const FK = `
  ALTER TABLE "invite_visits" ADD CONSTRAINT "invite_visits_convertedUserId_fkey"
    FOREIGN KEY ("convertedUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
`

const CREATE_COM_PK = `
  CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
  );
`

describe("extração de FK", () => {
  const [c] = constraintsDe(FK)

  it("captura tipo, tabela dona e colunas locais", () => {
    assert.equal(c.tipo, "FOREIGN KEY")
    assert.equal(c.tabela, "invite_visits")
    assert.deepEqual(c.colunas, ["convertedUserId"])
  })

  it("captura tabela e colunas referenciadas", () => {
    assert.equal(c.tabelaReferenciada, "users")
    assert.deepEqual(c.colunasReferenciadas, ["id"])
  })

  it("captura ON DELETE e ON UPDATE separadamente", () => {
    // Trocar um pelo outro é um erro fácil de cometer e difícil de ver.
    assert.equal(c.onDelete, "SET NULL")
    assert.equal(c.onUpdate, "CASCADE")
  })

  it("ausência de cláusula vira NO ACTION, o default do SQL", () => {
    const [semClausula] = constraintsDe(
      `ALTER TABLE "t" ADD CONSTRAINT "t_fk" FOREIGN KEY ("a") REFERENCES "u"("id");`
    )
    assert.equal(semClausula.onDelete, "NO ACTION")
    assert.equal(semClausula.onUpdate, "NO ACTION")
  })

  it("preserva a ORDEM das colunas numa FK composta", () => {
    // (a,b)→(x,y) não é a mesma constraint que (b,a)→(x,y).
    const [comp] = constraintsDe(
      `ALTER TABLE "t" ADD CONSTRAINT "t_fk" FOREIGN KEY ("a","b") REFERENCES "u"("x","y");`
    )
    assert.deepEqual(comp.colunas, ["a", "b"])
    assert.deepEqual(comp.colunasReferenciadas, ["x", "y"])
  })
})

describe("constraints inline em CREATE TABLE", () => {
  it("captura PRIMARY KEY nomeada dentro do CREATE TABLE", () => {
    // É onde vivem TODAS as PKs criadas pelas migrations Prisma — e a versão
    // anterior do auditor, que só olhava `ADD CONSTRAINT`, não via nenhuma.
    const [pk] = constraintsDe(CREATE_COM_PK)
    assert.equal(pk.nome, "push_subscriptions_pkey")
    assert.equal(pk.tipo, "PRIMARY KEY")
    assert.equal(pk.tabela, "push_subscriptions")
    assert.deepEqual(pk.colunas, ["id"])
  })

  it("captura UNIQUE e CHECK nomeadas inline", () => {
    const cs = constraintsDe(`
      CREATE TABLE "t" (
        "a" TEXT,
        "b" INT,
        CONSTRAINT "t_pkey" PRIMARY KEY ("a"),
        CONSTRAINT "t_a_b_key" UNIQUE ("a", "b"),
        CONSTRAINT "t_b_positivo" CHECK ("b" > 0)
      );
    `)
    const porNome = Object.fromEntries(cs.map((c) => [c.nome, c]))
    assert.equal(porNome["t_a_b_key"].tipo, "UNIQUE")
    assert.deepEqual(porNome["t_a_b_key"].colunas, ["a", "b"])
    assert.equal(porNome["t_b_positivo"].tipo, "CHECK")
    assert.equal(porNome["t_pkey"].tipo, "PRIMARY KEY")
  })
})

describe("DROP antes de ADD não duplica nem some", () => {
  it("o padrão de idempotência do repo produz UMA constraint esperada", () => {
    const cs = constraintsDe(`
      ALTER TABLE "t" DROP CONSTRAINT IF EXISTS "t_fk";
      ALTER TABLE "t" ADD CONSTRAINT "t_fk" FOREIGN KEY ("a") REFERENCES "u"("id") ON DELETE CASCADE;
    `)
    assert.equal(cs.length, 1)
    assert.equal(cs[0].onDelete, "CASCADE")
  })
})

describe("comparação semântica — o caso bom PASSA", () => {
  const esperada = constraintsDe(FK)[0]
  const real = {
    tipo: "FOREIGN KEY",
    tabela: "invite_visits",
    colunas: ["convertedUserId"],
    tabelaReferenciada: "users",
    colunasReferenciadas: ["id"],
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  }

  it("idêntica → nenhuma divergência", () => {
    assert.deepEqual(compararConstraint(esperada, real), [])
  })

  it("ausente no banco → uma divergência, não sete", () => {
    // Listar sete diferenças para algo que simplesmente não existe é ruído.
    assert.deepEqual(compararConstraint(esperada, null), ["ausente no banco"])
  })
})

describe("comparação semântica — CONTROLE NEGATIVO, cada atributo reprova", () => {
  const esperada = constraintsDe(FK)[0]
  const base = {
    tipo: "FOREIGN KEY",
    tabela: "invite_visits",
    colunas: ["convertedUserId"],
    tabelaReferenciada: "users",
    colunasReferenciadas: ["id"],
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  }

  const mutacoes = [
    ["ON DELETE trocado", { onDelete: "NO ACTION" }, /ON DELETE/],
    ["ON UPDATE trocado", { onUpdate: "NO ACTION" }, /ON UPDATE/],
    ["tabela referenciada errada", { tabelaReferenciada: "outra" }, /referencia/],
    ["coluna local errada", { colunas: ["outraColuna"] }, /colunas:/],
    ["coluna referenciada errada", { colunasReferenciadas: ["outra"] }, /colunas referenciadas/],
    ["tipo errado", { tipo: "UNIQUE" }, /tipo/],
    ["tabela dona errada", { tabela: "outra_tabela" }, /tabela:/],
  ]

  for (const [rotulo, mutacao, esperadoNaMensagem] of mutacoes) {
    it(`${rotulo} → REPROVA`, () => {
      const dif = compararConstraint(esperada, { ...base, ...mutacao })
      assert.ok(dif.length > 0, `${rotulo} passou despercebido`)
      assert.match(dif.join(" | "), esperadoNaMensagem)
    })
  }

  it("ordem das colunas invertida numa FK composta → REPROVA", () => {
    const comp = constraintsDe(
      `ALTER TABLE "t" ADD CONSTRAINT "t_fk" FOREIGN KEY ("a","b") REFERENCES "u"("x","y");`
    )[0]
    const dif = compararConstraint(comp, {
      tipo: "FOREIGN KEY", tabela: "t", colunas: ["b", "a"],
      tabelaReferenciada: "u", colunasReferenciadas: ["x", "y"],
      onDelete: "NO ACTION", onUpdate: "NO ACTION",
    })
    assert.ok(dif.length > 0, "ordem invertida deveria reprovar")
  })
})

describe("CHECK — normalização de expressão", () => {
  it("colapsa espaço em branco", () => {
    assert.equal(normalizarExpressao('b   >   0'), "b > 0")
    assert.equal(normalizarExpressao("b\n  >\t0"), "b > 0")
  })

  it("remove aspas de IDENTIFICADOR, nunca de literal de string", () => {
    assert.equal(normalizarExpressao('"status" > 0'), "status > 0")
    // 'active' é literal — trocar aspas mudaria o que a expressão diz.
    assert.equal(normalizarExpressao("status = 'active'"), "status = 'active'")
  })

  it("remove parênteses externos redundantes, um nível por vez", () => {
    assert.equal(normalizarExpressao("((b > 0))"), "b > 0")
  })

  it("NÃO remove parênteses que não envolvem a expressão inteira", () => {
    // Aqui o primeiro `(` fecha antes do fim — removê-lo mudaria o agrupamento.
    assert.equal(normalizarExpressao("(a > 0) AND (b > 0)"), "(a > 0) AND (b > 0)")
  })
})

/**
 * GATE-18 FIX-005 — o bug que este bloco trava.
 *
 * A versão anterior removia aspas de QUALQUER identificador. É inseguro:
 * Postgres dobra (fold) identificador SEM aspas para minúsculas antes de
 * resolver, mas preserva o case exato de um identificador COM aspas.
 * `"userId"` e `userId` podem ser colunas DIFERENTES (a segunda resolve para
 * `userid`) — remover a aspa cegamente as tornava indistinguíveis, um falso
 * PASS semântico.
 */
describe("CHECK — identificador citado com maiúscula NUNCA perde a aspa (FIX-005)", () => {
  it('"userId" citado vs userId sem aspas → permanecem DIFERENTES após normalizar', () => {
    // Sem aspas, `userId` dobraria para `userid` — coluna potencialmente
    // diferente de `"userId"`, que preserva o case exato.
    const citado = normalizarExpressao('"userId" IS NOT NULL')
    const semAspas = normalizarExpressao('userId IS NOT NULL')
    assert.notEqual(citado, semAspas, '"userId" e userId não podem normalizar igual')
  })

  it('"UserID" citado vs userid sem aspas → permanecem DIFERENTES', () => {
    const citado = normalizarExpressao('"UserID" > 0')
    const semAspas = normalizarExpressao("userid > 0")
    assert.notEqual(citado, semAspas)
  })

  it("consequência no comparador: REPROVA, não PASSA", () => {
    const doRepo = { tipo: "CHECK", tabela: "t", colunas: [], expressao: normalizarExpressao('"userId" IS NOT NULL') }
    const doBanco = { tipo: "CHECK", tabela: "t", colunas: [], expressao: normalizarExpressao("userId IS NOT NULL") }
    const dif = compararConstraint(doRepo, doBanco)
    assert.ok(dif.length > 0, '"userId" vs userId deveria reprovar no comparador real')
  })

  it("literal de string 'userId' nunca é tocado, mesmo perto de identificador citado", () => {
    // Caso adversarial: aspa dupla DENTRO de um literal de aspa simples.
    const e = normalizarExpressao(`status = 'userId' AND "userId" IS NOT NULL`)
    assert.match(e, /'userId'/, "o literal precisa sobreviver intacto")
    assert.match(e, /"userId"/, 'o identificador com maiúscula precisa continuar citado')
  })

  it("quoting IDÊNTICO nos dois lados → PASSA", () => {
    assert.equal(normalizarExpressao('"userId" IS NOT NULL'), normalizarExpressao('"userId" IS NOT NULL'))
  })

  it("identificador citado já minúsculo simples PODE perder a aspa — equivalência comprovada", () => {
    // `"foo"` citado e `foo` sem aspas resolvem para a MESMA coluna sempre:
    // sem aspas, Postgres dobra `foo` para `foo` (já é minúsculo) — não há
    // ambiguidade possível, ao contrário do caso com maiúscula.
    assert.equal(normalizarExpressao('"foo" > 0'), normalizarExpressao("foo > 0"))
  })

  it("whitespace cosmético continua passando, mesmo com identificador citado", () => {
    assert.equal(normalizarExpressao('"userId"   IS NOT NULL'), normalizarExpressao('"userId" IS NOT NULL'))
  })
})

/**
 * GATE-18 FIX-006 — o bug que este bloco trava.
 *
 * A versão anterior já preservava literais token a token, mas devolvia tudo
 * concatenado numa única string e SÓ DEPOIS rodava
 * `.replace(/\s+/g, " ")` sobre o resultado inteiro — recolapsando espaço em
 * branco que já estava DENTRO do literal preservado. `status = 'a  b'` e
 * `status = 'a b'` são expressões diferentes; as duas normalizavam igual.
 */
describe("CHECK — whitespace dentro de literal é INTOCÁVEL (FIX-006)", () => {
  it("dois espaços vs um espaço DENTRO do literal → permanecem DIFERENTES", () => {
    const dois = normalizarExpressao("status = 'a  b'")
    const um = normalizarExpressao("status = 'a b'")
    assert.notEqual(dois, um, "whitespace dentro do literal não pode ser cosmético")
  })

  it("consequência no comparador real: REPROVA, não PASSA", () => {
    const doRepo = { tipo: "CHECK", tabela: "t", colunas: [], expressao: normalizarExpressao("status = 'a  b'") }
    const doBanco = { tipo: "CHECK", tabela: "t", colunas: [], expressao: normalizarExpressao("status = 'a b'") }
    const dif = compararConstraint(doRepo, doBanco)
    assert.ok(dif.length > 0, "'a  b' vs 'a b' deveria reprovar no comparador real")
  })

  it("whitespace SÓ fora do literal continua cosmético → PASSA", () => {
    assert.equal(normalizarExpressao("status  =  'a b'"), normalizarExpressao("status = 'a b'"))
  })

  it("aspa simples escapada (`''`) dentro do literal sobrevive intacta", () => {
    const e = normalizarExpressao("status = 'it''s ok'")
    assert.match(e, /'it''s ok'/, "o escape `''` precisa continuar presente e no lugar certo")
  })

  it("aspas duplas DENTRO do literal sobrevivem intactas, inclusive com espaço nelas", () => {
    const e = normalizarExpressao(`status = 'ele disse  "oi  tudo bem"  '`)
    assert.equal(e, `status = 'ele disse  "oi  tudo bem"  '`, "nada dentro do literal pode mudar")
  })
})

describe("CHECK — parênteses externos são quote-aware (FIX-006)", () => {
  it("um `(` dentro do literal não conta como abertura de agrupamento", () => {
    // Sem quote-awareness, o "(" de dentro do literal poderia fechar a
    // profundidade no lugar errado e destruir a prova de redundância.
    const e = normalizarExpressao("(status = '(a)')")
    assert.equal(e, "status = '(a)'", "o parêntese externo real deveria ser removido; o do literal, preservado")
  })

  it("um `)` isolado dentro do literal não interrompe a contagem prematuramente", () => {
    const e = normalizarExpressao("(status = 'fecha) aqui')")
    assert.equal(e, "status = 'fecha) aqui'")
  })

  it("parêntese genuinamente externo continua removível", () => {
    assert.equal(normalizarExpressao("((b > 0))"), "b > 0")
  })

  it("parênteses que NÃO envolvem a expressão inteira continuam preservados", () => {
    assert.equal(normalizarExpressao("(a > 0) AND (b > 0)"), "(a > 0) AND (b > 0)")
  })

  it("identificador citado contendo parêntese no nome não interfere na contagem", () => {
    // Raro, mas legal em SQL: um nome de coluna citado pode conter qualquer
    // caractere, inclusive parênteses.
    const e = normalizarExpressao('("estranho(nome)" > 0)')
    assert.equal(e, '"estranho(nome)" > 0')
  })
})

describe("CHECK — regressão do FIX-005, preservada", () => {
  it('"userId" citado vs userId sem aspas continua REPROVANDO', () => {
    assert.notEqual(normalizarExpressao('"userId" > 0'), normalizarExpressao("userId > 0"))
  })

  it("identificador citado já minúsculo simples continua podendo normalizar", () => {
    assert.equal(normalizarExpressao('"foo" > 0'), normalizarExpressao("foo > 0"))
  })
})

describe("CHECK — extração de dentro de `CHECK (...)`", () => {
  it("extrai o corpo, removendo só o wrapper CHECK", () => {
    assert.equal(expressaoDoCheck("CHECK (b > 0)"), "b > 0")
  })

  it("normaliza a forma típica que pg_get_constraintdef devolve", () => {
    // Postgres reserializa com aspas de identificador e um parêntese extra.
    assert.equal(expressaoDoCheck('CHECK ((\"b\" > 0))'), "b > 0")
  })

  it("texto que não é CHECK(...) devolve null", () => {
    assert.equal(expressaoDoCheck("UNIQUE (a)"), null)
  })
})

describe("CHECK — os 4 testes negativos exigidos pelo FIX-004", () => {
  const migracao = (expr) =>
    constraintsDe(`CREATE TABLE "t" ("b" INT, CONSTRAINT "t_chk" CHECK (${expr}));`)[0]

  const bancoCom = (expr) => ({
    tipo: "CHECK",
    tabela: "t",
    colunas: [],
    expressao: expressaoDoCheck(`CHECK (${expr})`),
  })

  it("1. mesmo nome/tabela, limite diferente (b > 0 vs b > 100) → REPROVA", () => {
    const dif = compararConstraint(migracao("b > 0"), bancoCom("b > 100"))
    assert.ok(dif.length > 0)
    assert.match(dif.join(" "), /expressão CHECK/)
  })

  it("2. mesmo nome/tabela, coluna diferente (b vs c) → REPROVA", () => {
    // A coluna faz parte da expressão — comparar o texto normalizado já cobre
    // "coluna trocada" sem precisar entender a gramática da expressão.
    const dif = compararConstraint(migracao("b > 0"), bancoCom("c > 0"))
    assert.ok(dif.length > 0, "coluna diferente deveria reprovar")
  })

  it("3. expressão equivalente só por whitespace → PASSA", () => {
    const dif = compararConstraint(migracao("b > 0"), bancoCom("  b   >   0  "))
    assert.deepEqual(dif, [])
  })

  it("4. CHECK ausente no banco → REPROVA, com UMA divergência", () => {
    const dif = compararConstraint(migracao("b > 0"), null)
    assert.deepEqual(dif, ["ausente no banco"])
  })
})

describe("CHECK — prova de ponta a ponta com forma real do Postgres", () => {
  it("migration com aspas simples do repo == pg_get_constraintdef reformatado", () => {
    const doRepo = constraintsDe(`CREATE TABLE "t" ("b" INT, CONSTRAINT "t_chk" CHECK (b > 0));`)[0]
    // Forma típica de saída do Postgres: identificador entre aspas + parêntese extra.
    const doBanco = { tipo: "CHECK", tabela: "t", colunas: [], expressao: expressaoDoCheck('CHECK (("b" > 0))') }
    assert.deepEqual(compararConstraint(doRepo, doBanco), [])
  })
})

describe("statementsDe", () => {
  it("não corta em `;` dentro de string literal", () => {
    const s = statementsDe(`insert into t values ('a;b'); select 1;`)
    assert.equal(s.length, 2)
    assert.match(s[0], /a;b/)
  })

  it("mantém bloco DO $$ ... $$ inteiro", () => {
    const s = statementsDe(`do $$ begin raise exception 'x; y'; end $$;`)
    assert.equal(s.length, 1)
  })
})
