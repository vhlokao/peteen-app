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
  CHECKSUM_MATCH_CANONICAL,
  CHECKSUM_CONTEUDO,
  CHECKSUM_FORMATO,
  CHECKSUM_SEM_REGISTRO,
  WORKTREE_LF,
  WORKTREE_CRLF,
  WORKTREE_MIXED,
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
    const { lf, crlf } = checksumsDe("20250620120000_professional_availability_7_6")
    assert.notEqual(lf, crlf, "LF e CRLF do mesmo conteúdo têm de divergir")
  })

  it("é sha256 hex, o formato que o Prisma grava", () => {
    const { lf } = checksumsDe("20260821120000_invite_visit_funnel")
    assert.match(lf, /^[0-9a-f]{64}$/)
  })

  it("worktree é um eixo próprio, calculado a partir dos bytes reais em disco", () => {
    const { worktree } = checksumsDe("20260821120000_invite_visit_funnel")
    assert.ok([WORKTREE_LF, WORKTREE_CRLF, WORKTREE_MIXED].includes(worktree))
  })
})

/**
 * GATE-18 FIX-004 — o bug que esta suíte trava.
 *
 * `classificarChecksum` do FIX-003 aceitava a forma "disco" (bytes reais do
 * arquivo AGORA) como um dos formatos válidos de MATCH. Depois que o
 * `.gitattributes` normalizou o worktree para LF em máquinas que fizerem um
 * checkout novo, `disco === lf` passaria a valer, e o checksum CRLF histórico
 * gravado em PROD seria classificado como "confere" — escondendo exatamente o
 * drift que a auditoria existe para mostrar. A causa era estrutural: a função
 * comparava contra o WORKTREE em vez de comparar contra o CONTEÚDO. Corrigido
 * removendo `disco` da assinatura de `classificarChecksum` por completo — a
 * função não pode nem consultar o worktree, só `{ lf, crlf }`.
 */
describe("classificação de checksum — canônico (LF) vs histórico (CRLF) vs conteúdo", () => {
  const formas = { lf: "b".repeat(64), crlf: "c".repeat(64) }

  it("banco == LF → MATCH_CANONICAL", () => {
    assert.equal(classificarChecksum(formas.lf, formas).classe, CHECKSUM_MATCH_CANONICAL)
  })

  it("banco == CRLF (mesmo conteúdo, formato antigo) → FORMAT_ONLY_CHECKSUM_DRIFT", () => {
    const r = classificarChecksum(formas.crlf, formas)
    assert.equal(r.classe, CHECKSUM_FORMATO)
    assert.equal(r.finalDeLinha, "CRLF")
  })

  it("banco não bate com LF nem CRLF → CONTENT_CHECKSUM_DRIFT", () => {
    assert.equal(classificarChecksum("f".repeat(64), formas).classe, CHECKSUM_CONTEUDO)
  })

  it("sem registro no banco → SEM_REGISTRO, não é drift de nenhum tipo", () => {
    assert.equal(classificarChecksum(null, formas).classe, CHECKSUM_SEM_REGISTRO)
  })

  it("classificarChecksum não aceita nem consulta `disco` — só duas formas", () => {
    // Trava a correção em si: se alguém reintroduzir `disco` na assinatura e
    // usá-lo, este teste não pega isso diretamente, mas os dois testes de
    // fixture real abaixo pegam — são o teste que importa de verdade.
    const r = classificarChecksum("x".repeat(64), { lf: formas.lf, crlf: formas.crlf })
    assert.equal(r.classe, CHECKSUM_CONTEUDO)
  })
})

/**
 * FIX-004 item 3 — matriz de hashes REAIS de PROD, fornecida pelo orquestrador
 * e travada aqui como fixture. Se este teste passar, a auditoria classifica
 * corretamente a situação real do banco de produção — não uma simulação.
 */
describe("fixture real de PROD — professional_availability_7_6", () => {
  const NOME = "20250620120000_professional_availability_7_6"
  const HASH_PROD_CRLF = "4d5febaf3940b4e0c9ecc2e4c3511973fde3b50536d6429d6eeb23a8e7461f18"
  const HASH_LF_CANONICO = "9e24b1c88822b8a63d2e2d31049e3f583a4aff038cf77aec955e818188fef86f"

  it("o LF canônico calculado bate com o valor fornecido pelo orquestrador", () => {
    assert.equal(checksumsDe(NOME).lf, HASH_LF_CANONICO)
  })

  it("o checksum gravado em PROD é a forma CRLF calculada, não a LF", () => {
    assert.equal(checksumsDe(NOME).crlf, HASH_PROD_CRLF)
    assert.notEqual(checksumsDe(NOME).lf, HASH_PROD_CRLF)
  })

  it("classificado contra o hash real de PROD → FORMAT_ONLY_CHECKSUM_DRIFT, NUNCA MATCH", () => {
    const r = classificarChecksum(HASH_PROD_CRLF, checksumsDe(NOME))
    assert.equal(r.classe, CHECKSUM_FORMATO)
    assert.notEqual(r.classe, CHECKSUM_MATCH_CANONICAL, "o bug do FIX-003 fazia isto dar MATCH")
  })

  it("classificado contra o LF canônico → MATCH_CANONICAL", () => {
    assert.equal(classificarChecksum(HASH_LF_CANONICO, checksumsDe(NOME)).classe, CHECKSUM_MATCH_CANONICAL)
  })
})

/**
 * FIX-004 item 3 — "uma das outras 8 migrations, cujo checksum PROD == LF".
 *
 * O hash de PROD desta migration NÃO foi fornecido pelo orquestrador — só o
 * de `professional_availability_7_6` foi, no gate anterior. Para as outras 8,
 * a única evidência que tenho é o próprio LF canônico calculado localmente:
 * o RESULT do FIX-002 já registrava que o blob versionado bate com a forma LF
 * nas 9. Este teste fixa esse hash como valor conhecido e verifica que ele
 * classifica como MATCH_CANONICAL — não afirma tê-lo lido de `_prisma_migrations`
 * em produção, porque não li.
 */
describe("fixture — invite_visit_funnel, caso MATCH_CANONICAL", () => {
  const NOME = "20260821120000_invite_visit_funnel"
  const HASH_LF_CONHECIDO = "e1478eb6c539d8418a884098e60cf4b1e073481acf87922d26c646b83b842461"

  it("o LF calculado bate com o valor já registrado no FIX-002", () => {
    assert.equal(checksumsDe(NOME).lf, HASH_LF_CONHECIDO)
  })

  it("classificado contra esse hash → MATCH_CANONICAL", () => {
    const c = checksumsDe(NOME)
    assert.equal(classificarChecksum(HASH_LF_CONHECIDO, c).classe, CHECKSUM_MATCH_CANONICAL)
  })
})

describe("invariante: nenhuma migration do repositório diverge de si mesma por CONTEÚDO", () => {
  it("LF e CRLF do próprio arquivo nunca classificam como CONTENT_CHECKSUM_DRIFT", () => {
    for (const nome of nomesDeMigration()) {
      const c = checksumsDe(nome)
      for (const forma of [c.lf, c.crlf]) {
        assert.notEqual(
          classificarChecksum(forma, c).classe,
          CHECKSUM_CONTEUDO,
          `${nome}: uma forma do próprio conteúdo foi classificada como alterada`
        )
      }
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
