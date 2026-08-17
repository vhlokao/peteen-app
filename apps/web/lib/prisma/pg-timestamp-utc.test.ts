/**
 * Regressão do incidente de consistência temporal.
 *
 * Duas camadas, porque uma só não pega o bug:
 *
 *   1. TESTE PURO do parser — determinístico, roda em qualquer fuso.
 *   2. TESTE DE I/O REAL do `pg` — subprocessos com `TZ` diferente, consultando
 *      o Postgres de verdade. O bug original vivia EXATAMENTE aqui: nenhuma
 *      função de domínio deste projeto conseguiria observá-lo, porque ele
 *      acontece entre o driver e o banco. Um teste puro teria passado durante
 *      todo o incidente.
 *
 * O bloco de I/O é PULADO quando não há string de conexão disponível, para que
 * a suíte continue executável sem banco. Localmente ele lê `.env.local` sozinho
 * — sem depender de `dotenv`, que não é dependência de runtime deste app.
 *
 * Rodar: npm run test:temporal
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

import {
  PG_OID_TIMESTAMP_SEM_FUSO,
  parsePgTimestampComoUtc,
} from "./pg-timestamp-utc.ts"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ_APP = path.resolve(AQUI, "../..")
const MODULO_PARSER = path.join(AQUI, "pg-timestamp-utc.ts")

/** O literal exato do incidente em produção. */
const LITERAL_DO_INCIDENTE = "2026-08-17 21:48:09.773"
const INSTANTE_CORRETO = "2026-08-17T21:48:09.773Z"
/** O que a aplicação leu antes da correção, num runtime em UTC-3. */
const INSTANTE_ERRADO_UTC_MENOS_3 = "2026-08-18T00:48:09.773Z"

// ─────────────────────────────────────────────────────────────────────────────
// 1. Parser puro
// ─────────────────────────────────────────────────────────────────────────────

describe("parser — interpreta o literal como UTC", () => {
  it("reproduz o instante correto do incidente", () => {
    const d = parsePgTimestampComoUtc(LITERAL_DO_INCIDENTE)
    assert.equal(d?.toISOString(), INSTANTE_CORRETO)
  })

  it("NUNCA produz o valor deslocado que causou o BEFORE_START", () => {
    const d = parsePgTimestampComoUtc(LITERAL_DO_INCIDENTE)
    assert.notEqual(d?.toISOString(), INSTANTE_ERRADO_UTC_MENOS_3)
  })

  it("aceita o OID correto", () => {
    assert.equal(PG_OID_TIMESTAMP_SEM_FUSO, 1114)
  })

  it("sem fração (o Postgres omite `.000`)", () => {
    assert.equal(
      parsePgTimestampComoUtc("2026-08-17 21:48:09")?.toISOString(),
      "2026-08-17T21:48:09.000Z"
    )
  })

  it("fração com 1 e 2 dígitos — zeros à direita vêm cortados do banco", () => {
    // `.070` chega como `.07`: ler como 7 ms em vez de 70 seria um erro de
    // 63 ms, invisível em teste manual e corrosivo em comparação de instantes.
    assert.equal(
      parsePgTimestampComoUtc("2026-08-17 21:48:09.7")?.toISOString(),
      "2026-08-17T21:48:09.700Z"
    )
    assert.equal(
      parsePgTimestampComoUtc("2026-08-17 21:48:09.07")?.toISOString(),
      "2026-08-17T21:48:09.070Z"
    )
  })

  it("TRUNCA precisão além de milissegundo, nunca arredonda para cima", () => {
    // Arredondar inventaria até 1 ms que não existe no banco.
    assert.equal(
      parsePgTimestampComoUtc("2026-08-17 21:48:09.7779")?.toISOString(),
      "2026-08-17T21:48:09.777Z"
    )
  })

  it("aceita separador `T` além do espaço", () => {
    assert.equal(
      parsePgTimestampComoUtc("2026-08-17T21:48:09.773")?.toISOString(),
      INSTANTE_CORRETO
    )
  })

  it("null atravessa como null", () => {
    assert.equal(parsePgTimestampComoUtc(null), null)
  })

  it("é estável para meia-noite — a borda em que o dia civil vira", () => {
    // Um deslocamento de 3h aqui muda a DATA, não só a hora: foi o que
    // liberou 'Iniciar atendimento' um dia antes.
    assert.equal(
      parsePgTimestampComoUtc("2026-08-17 00:30:00")?.toISOString(),
      "2026-08-17T00:30:00.000Z"
    )
    assert.equal(
      parsePgTimestampComoUtc("2026-08-17 23:30:00")?.toISOString(),
      "2026-08-17T23:30:00.000Z"
    )
  })

  it("delega ao parser original o que não é timestamp comum", () => {
    // `infinity` não é produzido por este schema; a delegação existe para não
    // assumir responsabilidade por casos sem cobertura.
    assert.equal(parsePgTimestampComoUtc("infinity"), Infinity as unknown as Date)
  })

  it("independe do fuso do processo — mesma entrada, mesma saída", () => {
    // Trava conceitual: a função não lê `process.env.TZ` nem usa o construtor
    // multi-argumento de Date. A prova empírica em outro fuso está no bloco de
    // I/O abaixo.
    const fonte = parsePgTimestampComoUtc.toString()
    assert.ok(!fonte.includes("process.env"))
    assert.ok(!/new Date\(\s*Number\(ano\)/.test(fonte))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. I/O real do driver, em fusos diferentes
// ─────────────────────────────────────────────────────────────────────────────

/** Lê DATABASE_URL do ambiente ou, na falta, de `.env.local` / `.env`. */
function stringDeConexao(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  for (const arquivo of [".env.local", ".env"]) {
    try {
      const conteudo = readFileSync(path.join(RAIZ_APP, arquivo), "utf8")
      const achado = /^DATABASE_URL=(.+)$/m.exec(conteudo)
      if (achado?.[1]) return achado[1].trim().replace(/^["']|["']$/g, "")
    } catch {
      // arquivo ausente — segue para o próximo
    }
  }
  return null
}

/**
 * Consulta o banco num subprocesso com `TZ` fixo, com e sem o parser.
 * Subprocesso porque `TZ` só é lido pelo V8 na inicialização — mudar
 * `process.env.TZ` depois do boot não muda o comportamento de `Date`.
 */
function lerTimestampNoFuso(params: {
  tz: string
  comParser: boolean
  connectionString: string
}): { iso: string; literal: string; tzEfetivo: string } {
  const codigo = `
    import { Pool } from "pg"
    if (process.env.COM_PARSER === "1") {
      const m = await import(process.env.MODULO_PARSER)
      m.registrarParserDeTimestampUtc()
    }
    const pool = new Pool({ connectionString: process.env.PG_URL })
    const { rows } = await pool.query(
      "SELECT TIMESTAMP '${LITERAL_DO_INCIDENTE}' AS t, TIMESTAMP '${LITERAL_DO_INCIDENTE}'::text AS literal"
    )
    console.log(JSON.stringify({
      iso: rows[0].t.toISOString(),
      literal: rows[0].literal,
      tzEfetivo: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }))
    await pool.end()
  `

  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "--no-warnings", "-e", codigo],
    {
      cwd: RAIZ_APP,
      encoding: "utf8",
      env: {
        ...process.env,
        TZ: params.tz,
        PG_URL: params.connectionString,
        MODULO_PARSER: `file://${MODULO_PARSER.split(path.sep).join("/")}`,
        COM_PARSER: params.comParser ? "1" : "0",
      },
    }
  )

  if (r.status !== 0) {
    throw new Error(`subprocesso falhou (${params.tz}): ${r.stderr?.slice(0, 400)}`)
  }
  return JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
}

const conexao = stringDeConexao()

describe("I/O real do pg — o bug vivia aqui", { skip: conexao ? false : "sem DATABASE_URL" }, () => {
  const url = conexao as string

  it("America/Sao_Paulo SEM o parser: reproduz o incidente (+3h)", () => {
    const r = lerTimestampNoFuso({ tz: "America/Sao_Paulo", comParser: false, connectionString: url })
    assert.equal(r.literal, LITERAL_DO_INCIDENTE)
    assert.equal(r.iso, INSTANTE_ERRADO_UTC_MENOS_3)
  })

  it("America/Sao_Paulo COM o parser: instante correto", () => {
    const r = lerTimestampNoFuso({ tz: "America/Sao_Paulo", comParser: true, connectionString: url })
    assert.equal(r.literal, LITERAL_DO_INCIDENTE)
    assert.equal(r.iso, INSTANTE_CORRETO)
  })

  it("UTC COM o parser: idêntico — a correção não altera quem já estava certo", () => {
    const r = lerTimestampNoFuso({ tz: "UTC", comParser: true, connectionString: url })
    assert.equal(r.iso, INSTANTE_CORRETO)
  })

  it("UTC SEM o parser já estava correto — por isso o bug era invisível em CI", () => {
    const r = lerTimestampNoFuso({ tz: "UTC", comParser: false, connectionString: url })
    assert.equal(r.iso, INSTANTE_CORRETO)
  })

  it("com o parser, fusos diferentes convergem para o MESMO instante", () => {
    const sp = lerTimestampNoFuso({ tz: "America/Sao_Paulo", comParser: true, connectionString: url })
    const utc = lerTimestampNoFuso({ tz: "UTC", comParser: true, connectionString: url })
    const toquio = lerTimestampNoFuso({ tz: "Asia/Tokyo", comParser: true, connectionString: url })
    assert.equal(sp.iso, utc.iso)
    assert.equal(toquio.iso, utc.iso)
  })
})
