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
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"
import { identificarAlvo } from "./lib/target-db-guard.mjs"

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

  return {
    tabelas: capturar(sql, /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    colunas,
    indices: capturar(sql, /CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    enums: capturar(sql, /CREATE TYPE\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    politicas: capturar(sql, /CREATE POLICY\s+"([^"]+)"/gi),
    buckets: capturar(sql, /storage\.buckets[\s\S]{0,300}?VALUES\s*\(\s*'([^']+)'/gi),
    /** Re-executável sem erro? `CREATE` sem `IF NOT EXISTS` falha na segunda vez. */
    idempotente: criacoes.every((m) => m[1]),
  }
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
    ...item.enums.map((e) => [`enum ${e}`, estado.enums.has(e)]),
    ...item.politicas.map((p) => [`policy ${p}`, estado.politicas.has(p)]),
    ...item.buckets.map((b) => [`bucket ${b}`, estado.buckets.has(b)]),
  ]
  const presentes = checks.filter(([, ok]) => ok).length
  const efeito =
    checks.length === 0 ? "SEM_OBJETO" : presentes === checks.length ? "PRESENTE" : presentes === 0 ? "AUSENTE" : "PARCIAL"
  return { efeito, presentes, total: checks.length, faltando: checks.filter(([, ok]) => !ok).map(([d]) => d) }
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
    enums: await conjunto(`select typname from pg_type where typtype='e'`),
    politicas: await seguro(`select policyname from pg_policies where schemaname='storage' and tablename='objects'`),
    buckets: await seguro(`select id from storage.buckets`),
  }

  const linhasPrisma = await tentar(
    `select migration_name from _prisma_migrations order by started_at`,
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
  if (semFonte.length) {
    console.info(`\n═══ REGISTRADAS NO BANCO SEM FONTE NO REPOSITÓRIO (${semFonte.length}) ═══`)
    for (const r of semFonte) console.info(`  ${r.version}  ${r.name}`)
  }
}
