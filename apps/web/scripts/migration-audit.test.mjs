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
import { readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const DIR_MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "migrations")

/** Nomes das migrations Prisma, lidos do disco — sem hardcodar a lista. */
function nomesDeMigration() {
  return readdirSync(DIR_MIGRATIONS)
    .sort()
    .filter((n) => existsSync(join(DIR_MIGRATIONS, n, "migration.sql")))
}

import {
  semComentarios,
  objetosDe,
  vereditoDe,
  checksumsDe,
  classificarChecksum,
  driftDeFormato,
  CHECKSUM_OK,
  CHECKSUM_CONTEUDO,
  CHECKSUM_FORMATO,
} from "./migration-audit.mjs"

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

describe("constraints e FKs entram no efeito, com semântica", () => {
  it("a FK vem descrita, não só nomeada", () => {
    const o = objetosDe(`
      ALTER TABLE "push_subscriptions"
        ADD CONSTRAINT "push_subscriptions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
    `)
    assert.equal(o.constraints.length, 1)
    assert.deepEqual(o.constraints[0], {
      nome: "push_subscriptions_userId_fkey",
      tabela: "push_subscriptions",
      tipo: "FOREIGN KEY",
      colunas: ["userId"],
      tabelaReferenciada: "users",
      colunasReferenciadas: ["id"],
      onDelete: "CASCADE",
      onUpdate: "NO ACTION",
    })
  })

  it("PRIMARY KEY inline no CREATE TABLE entra no inventário", () => {
    // A versão anterior só olhava `ADD CONSTRAINT` e não via PK nenhuma.
    const o = objetosDe(`
      CREATE TABLE IF NOT EXISTS "care_media" (
        "id" TEXT NOT NULL,
        CONSTRAINT "care_media_pkey" PRIMARY KEY ("id")
      );
    `)
    assert.equal(o.constraints.length, 1)
    assert.equal(o.constraints[0].tipo, "PRIMARY KEY")
    assert.equal(o.constraints[0].nome, "care_media_pkey")
  })

  it("constraint com semântica DIVERGENTE reprova, mesmo com o nome certo", () => {
    // O ponto do FIX-003: nome igual e comportamento diferente não é "presente".
    const item = {
      tabelas: [], colunas: [], indices: [], enums: [], politicas: [], buckets: [],
      constraints: [
        {
          nome: "t_fk", tabela: "t", tipo: "FOREIGN KEY", colunas: ["a"],
          tabelaReferenciada: "u", colunasReferenciadas: ["id"],
          onDelete: "CASCADE", onUpdate: "NO ACTION",
        },
      ],
    }
    const estadoBase = {
      tabelas: new Set(), colunas: new Set(), indices: new Set(),
      enums: new Set(), politicas: new Set(), buckets: new Set(),
    }

    const iguais = vereditoDe(item, {
      ...estadoBase,
      constraints: new Map([["t_fk", { ...item.constraints[0] }]]),
    })
    assert.equal(iguais.efeito, "PRESENTE")

    const divergente = vereditoDe(item, {
      ...estadoBase,
      constraints: new Map([["t_fk", { ...item.constraints[0], onDelete: "NO ACTION" }]]),
    })
    assert.equal(divergente.efeito, "AUSENTE", "ON DELETE trocado tem de reprovar")
    assert.match(divergente.faltando.join(" "), /ON DELETE/)
  })
})

describe("checksums no formato do Prisma", () => {
  it("LF e CRLF produzem hashes diferentes — e é por isso que ambos são reportados", () => {
    // Se este teste algum dia falhar, a comparação de checksum virou inútil.
    const { disco, lf, crlf, difere } = checksumsDe("20250620120000_professional_availability_7_6")
    assert.equal(disco.length, 64)
    assert.notEqual(lf, crlf, "LF e CRLF do mesmo conteúdo têm de divergir")
    assert.equal(difere, disco !== lf)
  })

  it("é sha256 hex, o formato que o Prisma grava", () => {
    const { lf } = checksumsDe("20260821120000_invite_visit_funnel")
    assert.match(lf, /^[0-9a-f]{64}$/)
  })
})

describe("classificação de divergência de checksum", () => {
  const c = { disco: "a".repeat(64), lf: "b".repeat(64), crlf: "c".repeat(64) }

  it("bate com qualquer forma do arquivo → MATCH, e diz qual forma", () => {
    assert.equal(classificarChecksum(c.lf, c).classe, CHECKSUM_OK)
    assert.equal(classificarChecksum(c.lf, c).forma, "LF")
    assert.equal(classificarChecksum(c.crlf, c).forma, "CRLF")
  })

  it("não bate com nenhuma forma → CONTENT drift, não formato", () => {
    // A distinção que importa: alguém editou o SQL, e isso é histórico
    // corrompido — não um arquivo que trocou de final de linha.
    assert.equal(classificarChecksum("f".repeat(64), c).classe, CHECKSUM_CONTEUDO)
  })

  it("sem registro no banco não é drift", () => {
    assert.equal(classificarChecksum(null, c).classe, "SEM_REGISTRO")
  })

  /**
   * Deliberadamente NÃO se afirma aqui que `professional_availability_7_6`
   * está em CRLF.
   *
   * Estava, e é por isso que o `.gitattributes` com `eol=lf` foi adicionado.
   * Mas um teste que exigisse CRLF quebraria exatamente quando o guardrail
   * fizesse o seu trabalho — congelando como verdade um estado que existe para
   * ser corrigido. O invariante durável é outro: seja qual for o final de
   * linha, a divergência dessa migration nunca pode ser de CONTEÚDO.
   */
  it("nenhuma migration do repositório tem drift de CONTEÚDO contra si mesma", () => {
    for (const nome of nomesDeMigration()) {
      const c = checksumsDe(nome)
      for (const forma of [c.disco, c.lf, c.crlf]) {
        assert.notEqual(
          classificarChecksum(forma, c).classe,
          CHECKSUM_CONTEUDO,
          `${nome}: uma forma do próprio arquivo foi classificada como conteúdo alterado`
        )
      }
    }
  })

  it("quando há drift, ele é de FORMATO e nomeia o final de linha", () => {
    for (const nome of nomesDeMigration()) {
      const d = driftDeFormato(nome)
      if (d === null) continue // já normalizada — o estado desejado
      assert.equal(d.classe, CHECKSUM_FORMATO)
      assert.ok(["CRLF", "MISTO"].includes(d.finalDeLinha), `final de linha inesperado: ${d.finalDeLinha}`)
    }
  })
})

describe("veredito por efeito", () => {
  const item = { tabelas: ["a"], colunas: [], indices: ["i1", "i2"], enums: [], politicas: [], buckets: [], constraints: [] }
  const estado = (t, i) => ({
    tabelas: new Set(t), colunas: new Set(), indices: new Set(i),
    enums: new Set(), politicas: new Set(), buckets: new Set(), constraints: new Map(),
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
