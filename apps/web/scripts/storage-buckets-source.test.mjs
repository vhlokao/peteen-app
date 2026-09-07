/**
 * GATE-18 FASE C — invariantes da source of truth dos buckets.
 *
 * O que estes testes protegem:
 *
 * 1. A CONFIGURAÇÃO. Os números aqui não são preferência: `file_size_limit` e
 *    `allowed_mime_types` são a barreira FÍSICA que impede vídeo no bucket de
 *    foto e foto de 50 MiB no bucket de vídeo. Se alguém alterar um deles sem
 *    querer, a garantia some sem nenhum erro aparecer.
 *
 * 2. A FRONTEIRA ENTRE FASES. Policy de `storage.objects` pertence à Fase A.
 *    Duplicá-la aqui criaria duas fontes para a mesma regra de acesso, que é
 *    como divergência de segurança começa.
 *
 * 3. A NÃO-DESTRUTIVIDADE. A migration só pode convergir configuração de
 *    bucket. Um `DELETE`, um `TRUNCATE` ou qualquer statement contra
 *    `storage.objects` apagaria arquivos de usuário.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { semComentarios } from "./migration-audit.mjs"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const ARQ = join(RAIZ, "supabase", "migrations", "20260907150000_storage_buckets_source_of_truth.sql")
const existe = existsSync(ARQ)
const sql = existe ? readFileSync(ARQ, "utf8") : ""
const codigo = existe ? semComentarios(sql) : ""

/** Estado vivo confirmado idêntico em PROD e DEMO (GATE-015 / GATE-023). */
const ESPERADO = [
  { id: "avatars", publico: true, limite: 5242880, mime: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  { id: "pets", publico: true, limite: 5242880, mime: ["image/jpeg", "image/png", "image/webp"] },
  { id: "documents", publico: false, limite: 10485760, mime: ["image/jpeg", "image/png", "application/pdf"] },
  { id: "care-media", publico: false, limite: 5242880, mime: ["image/jpeg", "image/png", "image/webp"] },
  { id: "care-media-video", publico: false, limite: 52428800, mime: ["video/mp4", "video/quicktime"] },
]

/** Recorta o bloco VALUES de um bucket até o próximo id ou o fim do INSERT. */
function blocoDoBucket(id) {
  const i = codigo.indexOf(`'${id}',`)
  if (i === -1) return null
  const resto = codigo.slice(i)
  const fim = resto.indexOf("),")
  return fim === -1 ? resto : resto.slice(0, fim)
}

describe("Fase C — buckets declarados", { skip: !existe }, () => {
  it("declara exatamente os 5 buckets, sem um sexto", () => {
    const ids = [...codigo.matchAll(/\(\s*'([a-z-]+)',\s*'[a-z-]+',/g)].map((m) => m[1])
    assert.deepEqual(ids.sort(), ESPERADO.map((b) => b.id).sort())
  })

  for (const b of ESPERADO) {
    it(`${b.id}: public=${b.publico}, limite=${b.limite}, ${b.mime.length} MIME na ordem`, () => {
      const bloco = blocoDoBucket(b.id)
      assert.ok(bloco, `bucket ${b.id} não encontrado`)
      assert.match(bloco, new RegExp(`\\b${b.publico}\\b`), `public deveria ser ${b.publico}`)
      assert.match(bloco, new RegExp(`\\b${b.limite}\\b`), `file_size_limit deveria ser ${b.limite}`)
      // ordem importa: é como o array chega ao catálogo
      const arr = bloco.match(/ARRAY\[([^\]]+)\]/)
      assert.ok(arr, "allowed_mime_types ausente")
      const tipos = arr[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""))
      assert.deepEqual(tipos, b.mime)
    })
  }

  it("care-media-video usa exatamente 50 MiB", () => {
    assert.equal(52428800, 50 * 1024 * 1024)
    assert.match(blocoDoBucket("care-media-video"), /52428800/)
  })
})

describe("Fase C — não invade a Fase A", { skip: !existe }, () => {
  const PROIBIDO = [
    ["CREATE POLICY", /\bCREATE\s+POLICY\b/i],
    ["DROP POLICY", /\bDROP\s+POLICY\b/i],
    ["ENABLE ROW LEVEL SECURITY", /\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i],
    ["CREATE FUNCTION", /\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i],
    ["CREATE TRIGGER", /\bCREATE\s+(OR\s+REPLACE\s+)?TRIGGER\b/i],
    ["CREATE EVENT TRIGGER", /\bCREATE\s+EVENT\s+TRIGGER\b/i],
    ["GRANT", /\bGRANT\b/i],
    ["REVOKE", /\bREVOKE\b/i],
  ]
  for (const [nome, re] of PROIBIDO) {
    it(`não contém ${nome}`, () => {
      assert.doesNotMatch(codigo, re, `${nome} pertence à Fase A, não à Fase C`)
    })
  }
})

describe("Fase C — não destrói dado", { skip: !existe }, () => {
  const DESTRUTIVO = [
    ["DELETE", /\bDELETE\s+FROM\b/i],
    ["TRUNCATE", /\bTRUNCATE\b/i],
    ["DROP", /\bDROP\b/i],
    ["ALTER TABLE", /\bALTER\s+TABLE\b/i],
    ["referência a storage.objects", /\bstorage\.objects\b/i],
  ]
  for (const [nome, re] of DESTRUTIVO) {
    it(`não contém ${nome}`, () => {
      assert.doesNotMatch(codigo, re, `${nome} apagaria ou alteraria dado de usuário`)
    })
  }

  it("só tem BEGIN, um INSERT e COMMIT", () => {
    const tipos = codigo.split(";").map((s) => s.trim()).filter(Boolean)
      .map((s) => (s.match(/^\w+/) ?? ["?"])[0].toUpperCase())
    assert.deepEqual([...new Set(tipos)].sort(), ["BEGIN", "COMMIT", "INSERT"])
    assert.equal(tipos.filter((t) => t === "INSERT").length, 1)
  })

  it("converge por ON CONFLICT DO UPDATE, sem apagar e recriar", () => {
    assert.match(codigo, /ON\s+CONFLICT\s*\(\s*id\s*\)\s*DO\s+UPDATE/i)
  })

  it("o DO UPDATE toca só colunas de configuração", () => {
    const set = codigo.match(/DO\s+UPDATE\s+SET([\s\S]*?);/i)
    assert.ok(set, "cláusula SET não encontrada")
    const colunas = [...set[1].matchAll(/^\s*(\w+)\s*=/gm)].map((m) => m[1])
    assert.deepEqual(colunas.sort(), ["allowed_mime_types", "file_size_limit", "name", "public"])
  })
})
