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

import { constraintsDe, compararConstraint, statementsDe } from "./sql-constraints.mjs"

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
