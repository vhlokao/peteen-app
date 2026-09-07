/**
 * GATE-18 FASE B — invariantes do bootstrap relacional.
 *
 * O que estes testes protegem:
 *
 * 1. O baseline é o resultado PURO de `prisma migrate diff`. Se alguém editar o
 *    arquivo à mão — inclusive "só para acrescentar um cabeçalho" — o hash do
 *    manifesto para de bater e a verificação proposta no README
 *    (`migrate diff | diff - baseline.sql`) deixa de significar qualquer coisa.
 *
 * 2. O baseline é RELACIONAL. Misturar RLS, policy, função de segurança, grant
 *    ou Storage aqui apagaria a fronteira entre as fases e faria um ambiente
 *    novo receber segurança por acidente, em ordem não controlada.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

import { objetosDe } from "./migration-audit.mjs"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..")
const DIR = join(RAIZ, "prisma", "bootstrap")
const SQL = join(DIR, "current_relational_baseline.sql")
const MANIFESTO = join(DIR, "manifest.json")

const temArquivos = existsSync(SQL) && existsSync(MANIFESTO)

describe("bootstrap relacional — integridade", { skip: !temArquivos }, () => {
  const bytes = temArquivos ? readFileSync(SQL) : Buffer.alloc(0)
  const m = temArquivos ? JSON.parse(readFileSync(MANIFESTO, "utf8")) : {}

  it("o SHA-256 do manifesto bate com o arquivo em disco", () => {
    const real = createHash("sha256").update(bytes).digest("hex")
    assert.equal(real, m.baseline.sha256,
      "baseline foi alterado sem regenerar o manifesto — regenere, não edite à mão")
  })

  it("está declarado como NÃO automático", () => {
    assert.equal(m.automatic_execution, false)
    assert.equal(m.classification, "CURRENT_RELATIONAL_BOOTSTRAP")
  })

  it("não tem CRLF — o hash depende disso", () => {
    assert.ok(!bytes.toString("utf8").includes("\r\n"))
  })
})

describe("bootstrap relacional — é relacional e só", { skip: !temArquivos }, () => {
  const sql = temArquivos ? readFileSync(SQL, "utf8").replace(/^--.*$/gm, "") : ""

  const PROIBIDO = [
    ["CREATE POLICY", /\bCREATE\s+POLICY\b/i],
    ["ENABLE ROW LEVEL SECURITY", /\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i],
    ["CREATE FUNCTION", /\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i],
    ["CREATE TRIGGER", /\bCREATE\s+(OR\s+REPLACE\s+)?TRIGGER\b/i],
    ["CREATE EVENT TRIGGER", /\bCREATE\s+EVENT\s+TRIGGER\b/i],
    ["GRANT", /\bGRANT\b/i],
    ["REVOKE", /\bREVOKE\b/i],
    ["ALTER DEFAULT PRIVILEGES", /\bALTER\s+DEFAULT\s+PRIVILEGES\b/i],
    ["schema storage", /\bstorage\./i],
    ["schema auth", /\bauth\./i],
    ["INSERT de dados", /\bINSERT\s+INTO\b/i],
    ["DELETE de dados", /\bDELETE\s+FROM\b/i],
    ["DROP TABLE", /\bDROP\s+TABLE\b/i],
  ]

  for (const [nome, re] of PROIBIDO) {
    it(`não contém ${nome}`, () => {
      assert.doesNotMatch(sql, re, `${nome} pertence a outra fase, não ao bootstrap relacional`)
    })
  }
})

describe("bootstrap relacional — cobertura de objetos", { skip: !temArquivos }, () => {
  const o = temArquivos ? objetosDe(readFileSync(SQL, "utf8")) : null
  const m = temArquivos ? JSON.parse(readFileSync(MANIFESTO, "utf8")) : {}

  it("declara as 29 tabelas de domínio", () => {
    assert.equal(o.tabelas.length, 29)
    assert.equal(m.object_counts.tabelas, 29)
  })

  it("declara os 30 enums de domínio", () => {
    assert.equal(o.enums.length, 30)
    assert.equal(m.object_counts.enums, 30)
  })

  it("não declara policy nem bucket", () => {
    assert.equal(o.politicas.length, 0)
    assert.equal(o.buckets.length, 0)
  })

  it("preserva os enums de Trust com valores E ordem", () => {
    const sql = readFileSync(SQL, "utf8")
    assert.match(sql, /CREATE TYPE "TrustConnectionType" AS ENUM \('PARTNER_RECOMMENDS_PROFESSIONAL', 'TUTOR_RECOMMENDS_PROFESSIONAL', 'PROFESSIONAL_RECOMMENDS_PROFESSIONAL'\)/)
    assert.match(sql, /CREATE TYPE "TrustSourceType" AS ENUM \('PARTNER', 'TUTOR', 'PROFESSIONAL'\)/)
    assert.match(sql, /CREATE TYPE "TrustTargetType" AS ENUM \('PROFESSIONAL'\)/)
  })

  it("registra as lacunas conhecidas de índice parcial", () => {
    const objetos = m.known_completeness_gaps.map((g) => g.object)
    assert.ok(objetos.includes("services_professionalId_serviceType_active_key"))
    assert.ok(objetos.includes("verification_requests_one_pending_per_entity"))
    for (const g of m.known_completeness_gaps) assert.ok(g.source, `lacuna ${g.object} sem fonte declarada`)
  })
})
