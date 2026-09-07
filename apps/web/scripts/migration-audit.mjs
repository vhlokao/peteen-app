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
import { constraintsDe, compararConstraint, ACAO_POR_CODIGO, expressaoDoCheck, mascararLiterais } from "./lib/sql-constraints.mjs"
import { policiesDe, compararPolicy, chaveDaPolicy } from "./lib/sql-policies.mjs"

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

  /**
   * Busca de ESTRUTURA roda sobre o SQL mascarado — GATE-18 FIX-018 (BUG 2).
   *
   * O regex de `CREATE TABLE` casava dentro de literais. Com
   *
   *   WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
   *
   * no event trigger da migration de segurança, o auditor inventava uma
   * tabela chamada `AS` e reportava efeito faltando que nunca existiu.
   *
   * `mascararLiterais` preserva o comprimento, então índices e capturas
   * continuam válidos; identificadores citados não são tocados.
   *
   * ATENÇÃO: `buckets` continua lendo o texto ORIGINAL de propósito — o id do
   * bucket É o literal (`VALUES ('avatars', ...)`). Mascarar ali apagaria
   * justamente o valor que se quer capturar.
   */
  const mascarado = mascararLiterais(sql)

  const colunas = []
  for (const bloco of mascarado.split(/;\s*/)) {
    const t = bloco.match(/ALTER TABLE(?:\s+IF EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/i)
    if (!t) continue
    for (const m of bloco.matchAll(/ADD COLUMN(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi)) {
      colunas.push({ tabela: t[1], coluna: m[1] })
    }
  }

  const criacoes = [
    ...mascarado.matchAll(/CREATE TABLE(\s+IF NOT EXISTS)?/gi),
    ...mascarado.matchAll(/CREATE(?:\s+UNIQUE)?\s+INDEX(\s+IF NOT EXISTS)?/gi),
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
    tabelas: capturar(mascarado, /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:"?[A-Za-z_][A-Za-z0-9_]*"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    colunas,
    indices: capturar(mascarado, /CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+IF NOT EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    constraints,
    enums: capturar(mascarado, /CREATE TYPE\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi),
    // Identidade (schema, tabela, nome) + semântica. Ver lib/sql-policies.mjs.
    politicas: policiesDe(sql),
    buckets: capturar(sql, /storage\.buckets[\s\S]{0,300}?VALUES\s*\(\s*'([^']+)'/gi),
    /** Re-executável sem erro? `CREATE` sem `IF NOT EXISTS` falha na segunda vez. */
    idempotente: criacoes.every((m) => m[1]),
  }
}

/**
 * Checksums no formato que o Prisma grava: SHA-256 hex do conteúdo de
 * `migration.sql`, byte a byte — nas DUAS formas de final de linha que
 * representam o MESMO conteúdo lógico.
 *
 * `lf` é a forma CANÔNICA do repositório, reforçada por `.gitattributes`
 * (`eol=lf`). `crlf` é a mesma sequência de statements com `\n` → `\r\n` —
 * não é "o que está em disco agora", é a outra forma **válida** que o mesmo
 * conteúdo pode assumir. As duas são calculadas a partir do conteúdo LÓGICO,
 * nunca dos bytes crus do arquivo: dois arquivos com o mesmo texto e finais de
 * linha diferentes produzem exatamente estas duas mesmas hashes,
 * independentemente de como o disco local está agora.
 */
export function checksumsDe(nomeMigration) {
  const f = join(PRISMA_DIR, nomeMigration, "migration.sql")
  const bytes = readFileSync(f)
  const lf = Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8")
  const crlf = Buffer.from(lf.toString("utf8").replace(/\n/g, "\r\n"), "utf8")
  const sha = (b) => createHash("sha256").update(b).digest("hex")
  return { disco: sha(bytes), lf: sha(lf), crlf: sha(crlf), worktree: estadoDoWorktree(sha(bytes), sha(lf), sha(crlf)) }
}

/**
 * Estado do ARQUIVO NA ÁRVORE DE TRABALHO — eixo deliberadamente SEPARADO da
 * classificação do checksum do banco (ver `classificarChecksum` abaixo).
 *
 * Isto existe por causa de um bug real do FIX-003: a classificação anterior
 * aceitava a forma "disco" do arquivo atual como uma das formas válidas de
 * MATCH. Depois que o `.gitattributes` normalizou o worktree para LF,
 * `disco === lf` passou a valer para TODAS as migrations — inclusive
 * `professional_availability_7_6`, cujo checksum em PROD é o CRLF histórico.
 * O relatório passou a dizer "confere" para um banco que não mudou em NADA: o
 * que mudou foi um arquivo diferente, no computador de quem rodou a auditoria.
 *
 * Um auditor cujo veredito sobre o BANCO muda quando o WORKTREE muda não está
 * medindo o banco. Por isso o estado do worktree é reportado à parte, nunca
 * usado por `classificarChecksum`.
 */
export const WORKTREE_LF = "WORKTREE_CANONICAL_LF"
export const WORKTREE_CRLF = "WORKTREE_CRLF"
export const WORKTREE_MIXED = "WORKTREE_MIXED"

function estadoDoWorktree(hashDisco, hashLf, hashCrlf) {
  if (hashDisco === hashLf) return WORKTREE_LF
  if (hashDisco === hashCrlf) return WORKTREE_CRLF
  return WORKTREE_MIXED
}

/**
 * Classifica o checksum GRAVADO NO BANCO contra o conteúdo CANÔNICO atual do
 * arquivo — LF, mais sua forma CRLF equivalente. NUNCA recebe nem consulta o
 * estado do worktree (ver o comentário de `estadoDoWorktree` acima).
 *
 * Quatro classes, e a diferença entre as duas do meio é o ponto inteiro deste
 * módulo:
 *
 *   MATCH_CANONICAL              banco == LF (a forma que o repo considera certa)
 *   FORMAT_ONLY_CHECKSUM_DRIFT   banco == CRLF do MESMO conteúdo, mas != LF
 *   CONTENT_CHECKSUM_DRIFT       banco não bate com NENHUMA forma do conteúdo atual
 *   SEM_REGISTRO                 nada gravado para esta migration
 *
 * Confundir `FORMAT_ONLY` com `CONTENT` leva a duas reações erradas e opostas:
 * ignorar um drift de conteúdo real, ou "consertar" um falso alarme
 * reescrevendo uma migration já aplicada — a única ação aqui capaz de
 * corromper o histórico de verdade.
 */
export const CHECKSUM_MATCH_CANONICAL = "MATCH_CANONICAL"
export const CHECKSUM_FORMATO = "FORMAT_ONLY_CHECKSUM_DRIFT"
export const CHECKSUM_CONTEUDO = "CONTENT_CHECKSUM_DRIFT"
export const CHECKSUM_SEM_REGISTRO = "SEM_REGISTRO"

export function classificarChecksum(gravado, { lf, crlf }) {
  if (!gravado) return { classe: CHECKSUM_SEM_REGISTRO }
  if (gravado === lf) return { classe: CHECKSUM_MATCH_CANONICAL }
  if (gravado === crlf) return { classe: CHECKSUM_FORMATO, finalDeLinha: "CRLF" }
  return { classe: CHECKSUM_CONTEUDO }
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
    // Policy passa só se EXISTE e faz a mesma coisa. Ver lib/sql-policies.mjs.
    ...(item.politicas ?? []).map((p) => {
      const dif = compararPolicy(p, estado.politicas.get(chaveDaPolicy(p)) ?? null)
      const rotulo = `policy ${chaveDaPolicy(p)}`
      return [dif.length === 0 ? rotulo : `${rotulo} — ${dif.join('; ')}`, dif.length === 0]
    }),
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
           pg_get_constraintdef(con.oid)    as definicao,
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
      // `pg_get_constraintdef` devolve `CHECK (<expr>)` — mesma forma que o
      // parser do repositório produz a partir do SQL da migration, então a
      // MESMA função de normalização serve aos dois lados.
      expressao: r.tipo === "c" ? expressaoDoCheck(r.definicao) : undefined,
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
    /**
     * Policies de `public` E de `storage.objects` — GATE-18 FIX-018.
     *
     * Antes daqui só saía `storage.objects`, e só o nome. As 29 policies de
     * `public` criadas pela migration de segurança da Fase A eram invisíveis:
     * existiam no banco e o auditor as reportava como faltando.
     *
     * Restrito a esses dois schemas de propósito — varrer todos traria
     * policies de plataforma que nenhuma migration deste repositório declara.
     */
    politicas: new Map(
      (
        await tentar(
          `select schemaname, tablename, policyname, cmd, roles::text[] as roles,
                  permissive, qual, with_check
             from pg_policies
            where schemaname = 'public'
               or (schemaname = 'storage' and tablename = 'objects')`,
          [],
        )
      ).map((r) => {
        const p = {
          schema: r.schemaname,
          tabela: r.tablename,
          nome: r.policyname,
          comando: r.cmd,
          papeis: r.roles ?? [],
          permissiva: String(r.permissive).toUpperCase().startsWith('P') ? 'PERMISSIVE' : 'RESTRICTIVE',
          usando: r.qual,
          comCheck: r.with_check,
        }
        return [chaveDaPolicy(p), p]
      }),
    ),
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
    console.info("\n═══ CHECKSUM: banco × conteúdo canônico (LF) do repositório ═══")
    const porNome = new Map(linhasPrisma.map((r) => [r.migration_name, r]))
    for (const item of itens.filter((i) => i.origem === "prisma")) {
      const reg = porNome.get(item.nome)
      if (!reg) {
        console.info(`  ${item.nome.padEnd(52)} sem registro no banco`)
        continue
      }
      const c = checksumsDe(item.nome)
      const r = classificarChecksum(reg.checksum, c)
      const estadoReg =
        reg.rolled_back_at ? "ROLLED BACK ⚠" : reg.finished_at ? "finished" : "NÃO finalizada ⚠"

      const rotuloClasse =
        r.classe === CHECKSUM_MATCH_CANONICAL
          ? "MATCH_CANONICAL"
          : r.classe === CHECKSUM_FORMATO
            ? "FORMAT_ONLY_CHECKSUM_DRIFT (banco=CRLF, canonical=LF) ⚠"
            : r.classe === CHECKSUM_CONTEUDO
              ? "CONTENT_CHECKSUM_DRIFT ⚠"
              : CHECKSUM_SEM_REGISTRO

      console.info(
        `  ${item.nome.padEnd(52)} ${rotuloClasse.padEnd(56)} worktree=${c.worktree.padEnd(22)} ${estadoReg}`
      )

      if (r.classe === CHECKSUM_CONTEUDO) {
        console.info(`      banco       : ${reg.checksum}`)
        console.info(`      LF canônico : ${c.lf}`)
        console.info(`      CRLF        : ${c.crlf}`)
        console.info(`      → não bate com NENHUMA forma do conteúdo atual: investigar edição pós-aplicação.`)
      }
    }
  }
  if (semFonte.length) {
    console.info(`\n═══ REGISTRADAS NO BANCO SEM FONTE NO REPOSITÓRIO (${semFonte.length}) ═══`)
    for (const r of semFonte) console.info(`  ${r.version}  ${r.name}`)
  }
}
