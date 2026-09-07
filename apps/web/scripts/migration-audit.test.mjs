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
import { readdirSync, existsSync, readFileSync } from "node:fs"
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

/**
 * GATE-18 FIX-018 (BUG 2) — `CREATE TABLE` dentro de literal não é tabela.
 *
 * O auditor lia a cláusula do event trigger da migration de segurança
 *
 *   WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
 *
 * e inventava uma tabela chamada `AS`, que naturalmente não existia no banco —
 * produzindo efeito faltando que nunca deveria ter sido contado. Estes casos
 * travam as duas direções: o falso positivo tem que sumir E o `CREATE TABLE`
 * de verdade tem que continuar sendo detectado.
 */
describe("objetosDe — literais não são código (FIX-018)", () => {
  const EVENT_TRIGGER = `
    DO $do$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
        CREATE EVENT TRIGGER ensure_rls
          ON ddl_command_end
          WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
          EXECUTE FUNCTION public.rls_auto_enable();
      END IF;
    END
    $do$;
  `

  it("a tabela fantasma AS não existe mais", () => {
    assert.deepEqual(objetosDe(EVENT_TRIGGER).tabelas, [])
  })

  it("literal 'CREATE TABLE foo' não vira tabela", () => {
    assert.deepEqual(objetosDe(`INSERT INTO log(m) VALUES ('CREATE TABLE foo');`).tabelas, [])
  })

  it("CREATE TABLE dentro de comentário não vira tabela", () => {
    assert.deepEqual(objetosDe(`-- CREATE TABLE comentada (id int);\nSELECT 1;`).tabelas, [])
    assert.deepEqual(objetosDe(`/* CREATE TABLE bloco (id int); */\nSELECT 1;`).tabelas, [])
  })

  it("CREATE TABLE real continua detectado — sem aspas, citado, qualificado e IF NOT EXISTS", () => {
    assert.deepEqual(objetosDe(`CREATE TABLE foo (id int);`).tabelas, ["foo"])
    assert.deepEqual(objetosDe(`CREATE TABLE "Foo" (id int);`).tabelas, ["Foo"])
    assert.deepEqual(objetosDe(`CREATE TABLE public.foo (id int);`).tabelas, ["foo"])
    assert.deepEqual(objetosDe(`CREATE TABLE IF NOT EXISTS "Foo" (id int);`).tabelas, ["Foo"])
  })

  it("aspa escapada antes de um CREATE TABLE real não desalinha o scanner", () => {
    const sql = `SELECT 'it''s ok', 'CREATE TABLE fake'; CREATE TABLE real_t (id int);`
    assert.deepEqual(objetosDe(sql).tabelas, ["real_t"])
  })

  it("literal e código na mesma migration: só o código conta", () => {
    const sql = `${EVENT_TRIGGER}\nCREATE TABLE "de_verdade" (id int);`
    assert.deepEqual(objetosDe(sql).tabelas, ["de_verdade"])
  })

  /**
   * Controle de não-regressão do próprio fix: `buckets` extrai o id de DENTRO
   * de um literal. Se a busca de buckets passasse a usar o texto mascarado —
   * a mudança "óbvia" ao corrigir o BUG 2 — o valor sumiria em silêncio.
   */
  it("bucket continua sendo extraído do literal", () => {
    const sql = `INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);`
    assert.deepEqual(objetosDe(sql).buckets, ["avatars"])
  })
})

/**
 * GATE-18 FIX-018 (BUG 1) — policy tem schema, tabela e corpo.
 */
describe("objetosDe — policies com identidade completa (FIX-018)", () => {
  it("captura schema, tabela e nome, sem reduzir ao nome", () => {
    const sql = `
      CREATE POLICY "users: select own" ON public."users"
        AS PERMISSIVE FOR SELECT TO public
        USING (("authId" = ( SELECT auth.uid() AS uid)));
      CREATE POLICY "avatars: owner update" ON storage."objects"
        FOR UPDATE TO public
        USING ((bucket_id = 'avatars'::text));
    `
    const p = objetosDe(sql).politicas
    assert.equal(p.length, 2)
    assert.equal(p[0].schema, "public")
    assert.equal(p[0].tabela, "users")
    assert.equal(p[1].schema, "storage")
    assert.equal(p[1].tabela, "objects")
    assert.match(p[1].usando, /'avatars'/)
  })

  it("vereditoDe reprova policy com corpo diferente (falso PASS guardrail)", () => {
    const item = objetosDe(`CREATE POLICY "p" ON public."t" FOR SELECT TO public USING ((a = 1));`)
    const real = {
      schema: "public", tabela: "t", nome: "p", comando: "SELECT",
      papeis: ["public"], permissiva: "PERMISSIVE", usando: "(a = 2)", comCheck: null,
    }
    const estado = {
      tabelas: new Set(), colunas: new Set(), indices: new Set(), enums: new Set(),
      buckets: new Set(), constraints: new Map(),
      politicas: new Map([['public.t."p"', real]]),
    }
    const v = vereditoDe(item, estado)
    assert.equal(v.efeito, "AUSENTE", "corpo diferente não pode contar como presente")
    assert.ok(v.faltando[0].includes("USING"), `esperava drift de USING, veio: ${v.faltando[0]}`)
  })
})

/**
 * Trava da regressão que o próprio FIX-018 cometeu: mascarar blocos
 * dollar-quoted apagava `CREATE TYPE` real declarado no padrão idempotente
 * (`DO $$ … IF NOT EXISTS … CREATE TYPE … $$`), e `care_media_v0` caiu de 8/8
 * para 7/7 sem que nada acusasse erro.
 */
describe("objetosDe — DDL dentro de DO $$ é DDL de verdade (FIX-018)", () => {
  it("CREATE TYPE dentro de DO $$ continua sendo detectado", () => {
    const sql = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CareMediaType') THEN
          CREATE TYPE "CareMediaType" AS ENUM ('PHOTO');
        END IF;
      END $$;
    `
    assert.deepEqual(objetosDe(sql).enums, ["CareMediaType"])
  })

  it("CREATE TABLE dentro de DO $$ continua sendo detectado", () => {
    const sql = `DO $$ BEGIN CREATE TABLE "dentro_do_bloco" (id int); END $$;`
    assert.deepEqual(objetosDe(sql).tabelas, ["dentro_do_bloco"])
  })

  it("literal DENTRO do bloco DO continua mascarado", () => {
    const sql = `DO $$ BEGIN PERFORM 'CREATE TABLE falsa'; END $$;`
    assert.deepEqual(objetosDe(sql).tabelas, [])
  })

  it("care_media_v0 declara o enum CareMediaType (caso real da regressão)", () => {
    const f = join(DIR_MIGRATIONS, "20260813120000_care_media_v0", "migration.sql")
    if (!existsSync(f)) return
    assert.ok(
      objetosDe(readFileSync(f, "utf8")).enums.includes("CareMediaType"),
      "o enum de care_media_v0 sumiu do inventário",
    )
  })
})
