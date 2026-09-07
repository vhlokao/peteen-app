#!/usr/bin/env node
/**
 * Auditoria de migrations — GATE-18. SOMENTE LEITURA, por construção.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE SCRIPT EXISTE
 *
 * Neste banco, `_prisma_migrations` não existe e `supabase_migrations` conta
 * uma história que não bate com o repositório. Nesse cenário, "esta migration
 * foi aplicada?" não tem resposta pelo tracking — só pelo EFEITO: os objetos
 * que ela cria existem no schema?
 *
 * O script responde exatamente isso, e o faz de forma repetível para que a
 * comparação entre ambientes deixe de depender de alguém refazer a análise à
 * mão (que foi como este gate começou, e é como o erro volta).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A GARANTIA DE LEITURA É ESTRUTURAL, NÃO UMA PROMESSA
 *
 * Toda consulta roda dentro de `BEGIN; SET TRANSACTION READ ONLY;`. Se alguém
 * acrescentar um INSERT/UPDATE/DDL aqui um dia, o POSTGRES recusa — não este
 * arquivo. É a mesma lição de `scripts/lib/dry-run-clients.mjs`: uma garantia
 * que depende de o código lembrar de se comportar não é uma garantia.
 *
 * uso: node scripts/migration-audit.mjs [--env=<arquivo>]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"
import { identificarAlvo } from "./lib/target-db-guard.mjs"
import { constraintsDe, compararConstraint, ACAO_POR_CODIGO } from "./lib/sql-constraints.mjs"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..")
const PRISMA_DIR = join(RAIZ, "prisma", "migrations")
const SUPABASE_DIR = join(RAIZ, "..", "..", "supabase", "migrations")

// ── parsing do repositório ──────────────────────────────────────────────────

/**
 * Remove comentários antes de qualquer análise.
 *
 * Não é detalhe: as migrations deste repositório carregam blocos `-- ROLLBACK`
 * comentados com DROP TABLE/DROP COLUMN dentro. Um leitor ingênuo os conta
 * como statements destrutivos e conclui que o repositório é perigoso quando
 * não é. Foi o primeiro resultado desta auditoria, e estava errado.
 */
export function semComentarios(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((l) => {
      let dentroDeString = false
      for (let i = 0; i < l.length; i++) {
        if (l[i] === "'") dentroDeString = !dentroDeString
        if (!dentroDeString && l[i] === "-" && l[i + 1] === "-") return l.slice(0, i)
      }
      return l
    })
    .join("\n")
}

const unico = (a) => [...new Set(a)]
const capturar = (sql, re) => unico([...sql.matchAll(re)].map((m) => m[1]))

/** Objetos concretos que uma migration cria — a base da verificação por efeito. */
export function objetosDe(sqlBruto) {
  const sql = semComentarios(sqlBruto)

  const colunas = []
  for (const bloco of sql.split(/;\s*/)) {
    const t = bloco.match(/ALTER TABLE(?:\s+IF EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/i)
    if (!t) continue
    for (const m of bloco.matchAll(/ADD COLUMN(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi)) {
      colunas.push({ tabela: t[1], coluna: m[1] })
    }
  }

  const criacoes = [
    ...sql.matchAll(/CREATE TABLE(\s+IF NOT EXISTS)?/gi),
    ...sql.matchAll(/CREATE(?:\s+UNIQUE)?\s+INDEX(\s+IF NOT EXISTS)?/gi),
  ]

  /**
   * Constraints, agora com SEMÂNTICA e não só nome — ver lib/sql-constraints.mjs.
   *
   * Inclui as declaradas inline em `CREATE TABLE`, que é onde vivem todas as
   * primary keys criadas por estas migrations e que a versão anterior deste
   * auditor não enxergava.
   */
  const constraints = constraintsDe(sql)

  return {
    tabelas: capturar(sql, /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    colunas,
    indices: capturar(sql, /CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    constraints,
    enums: capturar(sql, /CREATE TYPE\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    politicas: capturar(sql, /CREATE POLICY\s+"([^"]+)"/gi),
    buckets: capturar(sql, /storage\.buckets[\s\S]{0,300}?VALUES\s*\(\s*'([^']+)'/gi),
    /** Re-executável sem erro? `CREATE` sem `IF NOT EXISTS` falha na segunda vez. */
    idempotente: criacoes.every((m) => m[1]),
  }
}

/**
 * Checksums no formato que o Prisma grava: SHA-256 hex do conteúdo de
 * `migration.sql`, byte a byte.
 *
 * Devolve as DUAS formas porque final de linha muda o hash, e este repositório
 * é editado no Windows: o git avisa "LF will be replaced by CRLF" a cada `add`.
 * Uma migration aplicada a partir de um checkout com um final de linha e lida
 * a partir de outro produz hashes diferentes com o MESMO conteúdo.
 */
export function checksumsDe(nomeMigration) {
  const f = join(PRISMA_DIR, nomeMigration, "migration.sql")
  const bytes = readFileSync(f)
  const lf = Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8")
  const crlf = Buffer.from(lf.toString("utf8").replace(/\n/g, "\r\n"), "utf8")
  const sha = (b) => createHash("sha256").update(b).digest("hex")
  return {
    disco: sha(bytes),
    lf: sha(lf),
    crlf: sha(crlf),
    difere: sha(bytes) !== sha(lf),
    finalDeLinha: sha(bytes) === sha(lf) ? "LF" : sha(bytes) === sha(crlf) ? "CRLF" : "MISTO",
  }
}

/**
 * Classifica uma divergência de checksum.
 *
 * A distinção que importa: um checksum que não bate porque alguém EDITOU o SQL
 * é um problema de histórico. Um que não bate porque o arquivo trocou de final
 * de linha é um problema de FORMATO — o conteúdo é idêntico caractere a
 * caractere, e nenhum statement mudou.
 *
 * Tratar os dois como a mesma coisa leva a duas reações erradas e opostas:
 * ignorar um drift real, ou "consertar" um falso alarme reescrevendo uma
 * migration já aplicada — que é a única coisa que realmente corrompe o
 * histórico.
 */
export const CHECKSUM_OK = "MATCH"
export const CHECKSUM_FORMATO = "FORMAT_ONLY_CHECKSUM_DRIFT"
export const CHECKSUM_CONTEUDO = "CONTENT_CHECKSUM_DRIFT"

export function classificarChecksum(gravado, { disco, lf, crlf }) {
  if (!gravado) return { classe: "SEM_REGISTRO" }
  if (gravado === disco) return { classe: CHECKSUM_OK, forma: "disco" }
  if (gravado === lf) return { classe: CHECKSUM_OK, forma: "LF" }
  if (gravado === crlf) return { classe: CHECKSUM_OK, forma: "CRLF" }

  // Não bate com nenhuma das formas do arquivo atual: o conteúdo mudou.
  return { classe: CHECKSUM_CONTEUDO }
}

/**
 * O arquivo local diverge da forma canônica do repositório (LF) apenas por
 * final de linha? Se sim, qualquer diferença de checksum contra um banco que
 * gravou a forma LF é FORMAT_ONLY — não é drift de conteúdo.
 */
export function driftDeFormato(nomeMigration) {
  const c = checksumsDe(nomeMigration)
  return c.difere ? { classe: CHECKSUM_FORMATO, finalDeLinha: c.finalDeLinha } : null
}

export function inventario() {
  const itens = []
  if (existsSync(PRISMA_DIR)) {
    for (const nome of readdirSync(PRISMA_DIR).sort()) {
      const f = join(PRISMA_DIR, nome, "migration.sql")
      if (existsSync(f)) itens.push({ nome, origem: "prisma", ...objetosDe(readFileSync(f, "utf8")) })
    }
  }
  if (existsSync(SUPABASE_DIR)) {
    for (const arq of readdirSync(SUPABASE_DIR).sort()) {
      if (!arq.endsWith(".sql")) continue
      itens.push({
        nome: arq.replace(/\.sql$/, ""),
        origem: "supabase",
        ...objetosDe(readFileSync(join(SUPABASE_DIR, arq), "utf8")),
      })
    }
  }
  return itens
}

/** Compara o que a migration cria com o que existe no banco. */
export function vereditoDe(item, estado) {
  const checks = [
    ...item.tabelas.map((t) => [`table ${t}`, estado.tabelas.has(t)]),
    ...item.colunas.map(({ tabela, coluna }) => [`col ${tabela}.${coluna}`, estado.colunas.has(`${tabela}.${coluna}`)]),
    ...item.indices.map((i) => [`idx ${i}`, estado.indices.has(i)]),
    // Constraint passa só se EXISTE e faz a mesma coisa. Ver compararConstraint.
    ...(item.constraints ?? []).map((c) => {
      const dif = compararConstraint(c, estado.constraints.get(c.nome) ?? null)
      return [
        dif.length === 0 ? `constraint ${c.nome}` : `constraint ${c.nome} — ${dif.join("; ")}`,
        dif.length === 0,
      ]
    }),
    ...item.enums.map((e) => [`enum ${e}`, estado.enums.has(e)]),
    ...item.politicas.map((p) => [`policy ${p}`, estado.politicas.has(p)]),
    ...item.buckets.map((b) => [`bucket ${b}`, estado.buckets.has(b)]),
  ]
  const presentes = checks.filter(([, ok]) => ok).length
  const efeito =
    checks.length === 0 ? "SEM_OBJETO" : presentes === checks.length ? "PRESENTE" : presentes === 0 ? "AUSENTE" : "PARCIAL"
  return { efeito, presentes, total: checks.length, faltando: checks.filter(([, ok]) => !ok).map(([d]) => d) }
}

/**
 * Constraints reais do banco, com a semântica completa — não só o nome.
 *
 * `conkey`/`confkey` são arrays de `attnum` NA ORDEM da constraint, e a ordem
 * importa numa FK composta: `(a, b)` referenciando `(x, y)` não é a mesma coisa
 * que `(b, a)`. Por isso o `unnest ... with ordinality`, em vez de um join que
 * devolveria as colunas em ordem arbitrária.
 */
async function constraintsDoBanco(client) {
  const { rows } = await client.query(`
    select con.conname                      as nome,
           con.contype                      as tipo,
           cl.relname                       as tabela,
           reftab.relname                   as tabela_referenciada,
           con.confdeltype                  as on_delete,
           con.confupdtype                  as on_update,
           (select array_agg(a.attname::text order by k.ord)
              from unnest(con.conkey) with ordinality k(num, ord)
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.num
           )                                as colunas,
           (select array_agg(a.attname::text order by k.ord)
              from unnest(coalesce(con.confkey, '{}')) with ordinality k(num, ord)
              join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.num
           )                                as colunas_referenciadas
      from pg_constraint con
      join pg_class cl        on cl.oid = con.conrelid
      join pg_namespace n     on n.oid = cl.relnamespace
      left join pg_class reftab on reftab.oid = con.confrelid
     where n.nspname = 'public'
  `)

  const TIPO = { f: "FOREIGN KEY", p: "PRIMARY KEY", u: "UNIQUE", c: "CHECK" }
  const mapa = new Map()
  for (const r of rows) {
    mapa.set(r.nome, {
      nome: r.nome,
      tipo: TIPO[r.tipo] ?? r.tipo,
      tabela: r.tabela,
      colunas: r.colunas ?? [],
      tabelaReferenciada: r.tabela_referenciada ?? undefined,
      colunasReferenciadas: r.colunas_referenciadas ?? [],
      onDelete: ACAO_POR_CODIGO[r.on_delete] ?? undefined,
      onUpdate: ACAO_POR_CODIGO[r.on_update] ?? undefined,
    })
  }
  return mapa
}

// ── execução ────────────────────────────────────────────────────────────────

const executadoDiretamente =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())

if (executadoDiretamente) {
  await import("dotenv/config")
  const arg = process.argv.find((a) => a.startsWith("--env="))
  if (arg) {
    const extra = readFileSync(join(RAIZ, arg.slice("--env=".length)), "utf8")
    for (const l of extra.split(/\r?\n/)) {
      if (!/^[A-Za-z_]/.test(l) || !l.includes("=")) continue
      const i = l.indexOf("=")
      process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "")
    }
  }

  const url = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]
  const alvo = identificarAlvo(url)
  if (!alvo) {
    console.error("Sem DIRECT_URL/DATABASE_URL reconhecível — nada a auditar.")
    process.exit(1)
  }
  console.info(`banco auditado: ${alvo.host}  (ref: ${alvo.ref})\n`)

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()

  // A transação read-only é a garantia. Não confie no bom comportamento acima.
  await client.query("BEGIN")
  await client.query("SET TRANSACTION READ ONLY")

  /**
   * Consulta que PODE falhar (tabela inexistente), isolada em SAVEPOINT.
   *
   * Sem isto, a primeira falha aborta a transação inteira e TODAS as consultas
   * seguintes falham com "current transaction is aborted" — que o catch
   * transformaria em "tabela ausente". Foi exatamente o que aconteceu na
   * primeira execução deste script: ele relatou `supabase_migrations` como
   * AUSENTE logo depois de `_prisma_migrations` falhar, quando a tabela existe
   * e tem 18 registros. Um auditor que mente sobre o que não encontrou é pior
   * do que nenhum auditor.
   */
  const tentar = async (sql, aoFalhar) => {
    await client.query("SAVEPOINT s")
    try {
      const r = await client.query(sql)
      await client.query("RELEASE SAVEPOINT s")
      return r.rows
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT s")
      return aoFalhar
    }
  }

  const conjunto = async (sql) => new Set((await client.query(sql)).rows.map((r) => Object.values(r)[0]))
  const seguro = async (sql) =>
    new Set((await tentar(sql, [])).map((r) => Object.values(r)[0]))

  const estado = {
    tabelas: await conjunto(`select table_name from information_schema.tables where table_schema='public'`),
    colunas: await conjunto(`select table_name||'.'||column_name from information_schema.columns where table_schema='public'`),
    indices: await conjunto(`select indexname from pg_indexes where schemaname='public'`),
    constraints: await constraintsDoBanco(client),
    enums: await conjunto(`select typname from pg_type where typtype='e'`),
    politicas: await seguro(`select policyname from pg_policies where schemaname='storage' and tablename='objects'`),
    buckets: await seguro(`select id from storage.buckets`),
  }

  /**
   * Forma dos objetos de unicidade — onde DEMO e PROD divergem.
   *
   * `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE` grava em `pg_constraint` E cria
   * um índice de apoio com o mesmo nome. `CREATE UNIQUE INDEX` cria só o
   * índice. As duas formas enforçam a mesma regra e são indistinguíveis pelo
   * `schema.prisma` (ambas viram `@@unique`), então a divergência sobrevive
   * sem ninguém notar — até uma ferramenta que compara catálogo, como
   * `migrate diff`, propor DDL para "consertar".
   */
  const formaUnicidade = await tentar(
    `select i.indexname, i.tablename, coalesce(con.contype::text, 'indice') as forma
       from pg_indexes i
       left join pg_constraint con
         on con.conname = i.indexname and con.contype in ('u','p')
      where i.schemaname = 'public' and i.indexdef ilike 'CREATE UNIQUE INDEX%'
      order by forma, i.tablename`,
    []
  )

  const linhasPrisma = await tentar(
    `select migration_name, checksum, finished_at, rolled_back_at
       from _prisma_migrations order by started_at`,
    null
  )
  const trackingPrisma = linhasPrisma === null ? null : linhasPrisma.map((r) => r.migration_name)

  const trackingSupabase = await tentar(
    `select version, name from supabase_migrations.schema_migrations order by version`,
    null
  )

  await client.query("COMMIT")
  await client.end()

  console.info("═══ TRACKING ═══")
  console.info(`_prisma_migrations              : ${trackingPrisma === null ? "AUSENTE (tabela não existe)" : `${trackingPrisma.length} registro(s)`}`)
  console.info(`supabase_migrations             : ${trackingSupabase === null ? "AUSENTE" : `${trackingSupabase.length} registro(s)`}`)

  const itens = inventario()
  const nomesSupabaseTrack = new Set((trackingSupabase ?? []).map((r) => `${r.version}_${r.name}`))
  const nomesPrismaTrack = new Set(trackingPrisma ?? [])

  console.info("\n═══ RECONCILIAÇÃO POR EFEITO ═══")
  console.info("(tracking = registrado na tabela de histórico; efeito = objetos existem no schema)\n")

  for (const item of itens) {
    const v = vereditoDe(item, estado)
    const track =
      item.origem === "prisma"
        ? nomesPrismaTrack.has(item.nome)
        : nomesSupabaseTrack.has(item.nome) || [...nomesSupabaseTrack].some((n) => n.includes(item.nome.replace(/^\d+_/, "")))

    const veredito =
      v.efeito === "SEM_OBJETO" ? "SEM_OBJETO_VERIFICAVEL"
      : track && v.efeito === "PRESENTE" ? "TRACKED_AND_PRESENT"
      : !track && v.efeito === "PRESENTE" ? "UNTRACKED_BUT_PRESENT"
      : track && v.efeito === "AUSENTE" ? "TRACKED_BUT_MISSING"
      : !track && v.efeito === "AUSENTE" ? "NOT_APPLIED"
      : "PARTIAL_DRIFT"

    console.info(`${item.nome.padEnd(52)} [${item.origem.padEnd(8)}] track=${track ? "sim" : "NÃO"} efeito=${v.presentes}/${v.total} → ${veredito}`)
    if (v.faltando.length) console.info(`      faltando: ${v.faltando.join(", ")}`)
  }

  /**
   * Casamento por VERSÃO exata, não por substring do nome.
   *
   * Com substring, a entrada `rls_policies` casava com o arquivo
   * `20260720000000_avatars_bucket_rls_policies` — migrations diferentes, de
   * meses diferentes — e sumia da lista de "sem fonte". Um relatório que
   * esconde um item por coincidência de nome é pior do que um que não checa.
   */
  const versoesNoRepo = new Set(itens.map((i) => i.nome.match(/^(\d+)/)?.[1]).filter(Boolean))
  const semFonte = (trackingSupabase ?? []).filter((r) => !versoesNoRepo.has(String(r.version)))

  // ── forma de unicidade ────────────────────────────────────────────────────
  const comConstraint = formaUnicidade.filter((r) => r.forma === "u")
  const primarias = formaUnicidade.filter((r) => r.forma === "p")
  const soIndice = formaUnicidade.filter((r) => r.forma === "indice")
  console.info(`\n═══ FORMA DAS UNIQUE (${formaUnicidade.length} índices únicos) ═══`)
  console.info(`  UNIQUE CONSTRAINT (pg_constraint) : ${comConstraint.length}`)
  console.info(`  PRIMARY KEY                       : ${primarias.length}`)
  console.info(`  apenas UNIQUE INDEX               : ${soIndice.length}`)
  for (const r of comConstraint) console.info(`    constraint → ${r.tablename}.${r.indexname}`)

  // ── checksums ─────────────────────────────────────────────────────────────
  if (linhasPrisma?.length) {
    console.info("\n═══ CHECKSUM: banco × arquivo do repositório ═══")
    const porNome = new Map(linhasPrisma.map((r) => [r.migration_name, r]))
    for (const item of itens.filter((i) => i.origem === "prisma")) {
      const reg = porNome.get(item.nome)
      if (!reg) {
        console.info(`  ${item.nome.padEnd(52)} sem registro no banco`)
        continue
      }
      const c = checksumsDe(item.nome)
      const { classe, forma } = classificarChecksum(reg.checksum, c)
      const estadoReg =
        reg.rolled_back_at ? "ROLLED BACK ⚠" : reg.finished_at ? "finished" : "NÃO finalizada ⚠"

      const rotulo =
        classe === CHECKSUM_OK
          ? `confere (${forma})${c.difere ? ` · arquivo local em ${c.finalDeLinha}` : ""}`
          : `${classe} ⚠`
      console.info(`  ${item.nome.padEnd(52)} ${rotulo.padEnd(38)} ${estadoReg}`)

      if (classe === CHECKSUM_CONTEUDO) {
        console.info(`      banco : ${reg.checksum}`)
        console.info(`      LF    : ${c.lf}`)
        console.info(`      CRLF  : ${c.crlf}`)
        console.info(`      → não bate com NENHUMA forma do arquivo atual: o conteúdo mudou.`)
      }
    }
  }
  if (semFonte.length) {
    console.info(`\n═══ REGISTRADAS NO BANCO SEM FONTE NO REPOSITÓRIO (${semFonte.length}) ═══`)
    for (const r of semFonte) console.info(`  ${r.version}  ${r.name}`)
  }
}
