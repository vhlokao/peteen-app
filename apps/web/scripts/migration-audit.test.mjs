/**
 * GATE-18 — parser da auditoria de migrations.
 *
 * Estes testes travam os dois erros que a própria auditoria cometeu antes de
 * ser corrigida. Ambos produziam relatórios confiantes e errados, que é a pior
 * falha possível numa ferramenta de auditoria:
 *
 *   1. contar DROP TABLE/DROP COLUMN que estão dentro de blocos `-- ROLLBACK`
 *      comentados, concluindo que migrations puramente aditivas são destrutivas;
 *   2. tratar `CREATE TABLE` sem `IF NOT EXISTS` como re-executável.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { semComentarios, objetosDe, vereditoDe } from "./migration-audit.mjs"

describe("comentários não são statements", () => {
  it("bloco ROLLBACK comentado não vira DDL", () => {
    // Formato real das migrations deste repositório.
    const sql = [
      'ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);',
      "-- ROLLBACK (não executar)",
      '--   ALTER TABLE "service_requests" DROP COLUMN IF EXISTS "endAt";',
      '--   DROP TABLE IF EXISTS "care_media";',
    ].join("\n")

    const limpo = semComentarios(sql)
    assert.ok(!/DROP\s+TABLE/i.test(limpo), "DROP TABLE comentado vazou para o SQL analisado")
    assert.ok(!/DROP\s+COLUMN/i.test(limpo), "DROP COLUMN comentado vazou")
    assert.ok(/ADD COLUMN/i.test(limpo), "o statement real foi removido junto")
  })

  it("um traço duplo dentro de string literal não corta a linha", () => {
    const sql = `insert into t (nome) values ('valor--com-traco');`
    assert.match(semComentarios(sql), /valor--com-traco/)
  })
})

describe("extração de objetos", () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS "push_subscriptions" ("id" TEXT NOT NULL);
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "runtimeEnvironment" VARCHAR(16);
    CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
    CREATE TYPE "CareMediaType" AS ENUM ('PHOTO', 'VIDEO');
  `

  it("captura tabela, coluna com a tabela certa, índice e enum", () => {
    const o = objetosDe(sql)
    assert.deepEqual(o.tabelas, ["push_subscriptions"])
    assert.deepEqual(o.colunas, [{ tabela: "push_subscriptions", coluna: "runtimeEnvironment" }])
    assert.deepEqual(o.indices, ["push_subscriptions_endpoint_key"])
    assert.deepEqual(o.enums, ["CareMediaType"])
  })

  it("uma coluna é sempre atribuída à tabela do seu próprio ALTER", () => {
    // Com dois ALTER no mesmo arquivo, associar a coluna à tabela errada
    // faria a verificação de efeito procurar um objeto que nunca existiu.
    const o = objetosDe(`
      ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "defaultDurationMin" INTEGER;
      ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "durationMin" INTEGER;
    `)
    assert.deepEqual(o.colunas, [
      { tabela: "services", coluna: "defaultDurationMin" },
      { tabela: "service_requests", coluna: "durationMin" },
    ])
  })
})

describe("idempotência", () => {
  it("CREATE com IF NOT EXISTS → idempotente", () => {
    assert.equal(objetosDe(`CREATE TABLE IF NOT EXISTS "t" ("id" TEXT);`).idempotente, true)
  })

  it("CREATE TABLE sem guarda → NÃO idempotente", () => {
    // É o caso real de notification_reads e invite_visits: reexecutar dá erro.
    assert.equal(objetosDe(`CREATE TABLE "notification_reads" ("id" TEXT);`).idempotente, false)
  })

  it("índice sem guarda também derruba a idempotência", () => {
    assert.equal(objetosDe(`CREATE UNIQUE INDEX "i" ON "t"("c");`).idempotente, false)
  })
})

describe("veredito por efeito", () => {
  const item = { tabelas: ["a"], colunas: [], indices: ["i1", "i2"], enums: [], politicas: [], buckets: [] }
  const estado = (t, i) => ({
    tabelas: new Set(t), colunas: new Set(), indices: new Set(i),
    enums: new Set(), politicas: new Set(), buckets: new Set(),
  })

  it("tudo presente → PRESENTE", () => {
    assert.equal(vereditoDe(item, estado(["a"], ["i1", "i2"])).efeito, "PRESENTE")
  })

  it("nada presente → AUSENTE", () => {
    assert.equal(vereditoDe(item, estado([], [])).efeito, "AUSENTE")
  })

  it("parte presente → PARCIAL, e diz o que falta", () => {
    // O caso real de avatars_bucket_rls_policies: 1 de 3 policies.
    const v = vereditoDe(item, estado(["a"], ["i1"]))
    assert.equal(v.efeito, "PARCIAL")
    assert.deepEqual(v.faltando, ["idx i2"])
  })
})
