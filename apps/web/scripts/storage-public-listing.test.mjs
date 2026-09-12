/**
 * SEAL-P2-01 — anônimo não enumera `avatars` nem `pets`.
 *
 * Contrato sobre as FONTES versionadas das policies de `storage.objects`, sem
 * banco. Reconstrói o estado efetivo aplicando, em ordem, a migration de
 * segurança da Fase A e a correção forward-only, e AVALIA cada policy de SELECT
 * contra três visitantes: anônimo, dono autenticado e outro autenticado.
 *
 * Por que avaliar e não só procurar texto: RLS combina policies do mesmo
 * comando por OR. Uma única policy aberta sobrando — com qualquer nome — basta
 * para reabrir a listagem. O avaliador abaixo só entende os átomos que as nossas
 * policies usam; um átomo desconhecido FALHA o teste em vez de ser ignorado, o
 * que obriga a revisar este contrato quando a forma das policies mudar.
 *
 * O que NÃO é testado aqui, por desenho: a leitura por URL pública. Ela depende
 * de `storage.buckets.public = true` (fonte: 20260907150000, conferida em
 * storage-buckets-source.test.mjs) e não consulta policy nenhuma.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { policiesDe, chaveDaPolicy } from "./lib/sql-policies.mjs"
import { semComentarios } from "./migration-audit.mjs"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const ler = (nome) => readFileSync(join(RAIZ, "supabase", "migrations", nome), "utf8")

const FASE_A = "20260907140100_storage_security_forward_only.sql"
const CORRECAO = "20260912230000_public_buckets_no_anonymous_listing.sql"

/** Nomes removidos por `DROP POLICY [IF EXISTS] "<nome>" ON storage.objects`. */
function dropsDe(sql) {
  return [...semComentarios(sql).matchAll(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"([^"]+)"\s+ON\s+storage\."?objects"?/gi)].map(
    (m) => `storage.objects."${m[1]}"`
  )
}

/** Estado efetivo depois de aplicar as migrations em ordem. */
function estadoEfetivo(nomes) {
  const estado = new Map()
  for (const nome of nomes) {
    const sql = ler(nome)
    for (const chave of dropsDe(sql)) estado.delete(chave)
    for (const p of policiesDe(sql)) if (p.schema === "storage" && p.tabela === "objects") estado.set(chaveDaPolicy(p), p)
  }
  return [...estado.values()]
}

// ── avaliador mínimo de USING ───────────────────────────────────────────────

function tirarParentesesExternos(s) {
  s = s.trim()
  while (s.startsWith("(") && s.endsWith(")")) {
    let nivel = 0
    let fechaNoFim = true
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") nivel++
      else if (s[i] === ")") nivel--
      if (nivel === 0 && i < s.length - 1) { fechaNoFim = false; break }
    }
    if (!fechaNoFim) break
    s = s.slice(1, -1).trim()
  }
  return s
}

function dividirAnd(s) {
  const partes = []
  let nivel = 0, inicio = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") nivel++
    else if (s[i] === ")") nivel--
    else if (nivel === 0 && /^\sAND\s/i.test(s.slice(i, i + 5))) { partes.push(s.slice(inicio, i)); inicio = i + 5; i += 4 }
  }
  partes.push(s.slice(inicio))
  return partes.map(tirarParentesesExternos)
}

/** ctx = { bucket, name, role, uid } — uid null para anônimo. */
function avaliar(expressao, ctx) {
  const e = tirarParentesesExternos(expressao)
  const partes = dividirAnd(e)
  if (partes.length > 1) return partes.every((p) => avaliar(p, ctx))

  let m
  if ((m = /^bucket_id\s*=\s*'([^']+)'(?:::text)?$/i.exec(e))) return ctx.bucket === m[1]
  if ((m = /^auth\.role\(\)\s*=\s*'([^']+)'(?:::text)?$/i.exec(e))) return ctx.role === m[1]
  if (/^name\s+IS\s+NOT\s+NULL$/i.test(e)) return ctx.name != null
  if (/^\(?storage\.foldername\(name\)\)?\[1\]\s*=\s*\(?auth\.uid\(\)\)?(?:::text)?$/i.test(e)) {
    return ctx.uid != null && ctx.name.split("/")[0] === ctx.uid
  }
  throw new Error(`átomo de policy não reconhecido pelo contrato: ${e}`)
}

const DONO = "11111111-1111-4111-8111-111111111111"
const OUTRO = "22222222-2222-4222-8222-222222222222"
const visitantes = {
  anonimo: { role: "anon", uid: null },
  dono: { role: "authenticated", uid: DONO },
  outro: { role: "authenticated", uid: OUTRO },
}

/** Algum SELECT (ou ALL) autoriza este visitante a ver o objeto? RLS = OR. */
function podeVer(policies, bucket, visitante) {
  const ctx = { bucket, name: `${DONO}/foto.jpg`, ...visitante }
  return policies
    .filter((p) => p.comando === "SELECT" || p.comando === "ALL")
    .filter((p) => p.permissiva === "PERMISSIVE")
    .some((p) => p.usando != null && avaliar(p.usando, ctx))
}

// ── testes ──────────────────────────────────────────────────────────────────

describe("SEAL-P2-01 — o contrato detecta o defeito (estado ANTES da correção)", () => {
  const antes = estadoEfetivo([FASE_A])
  for (const bucket of ["avatars", "pets"]) {
    it(`${bucket}: sem a correção, anônimo CONSEGUIA ver/listar — prova de que o avaliador pega o furo`, () => {
      assert.equal(podeVer(antes, bucket, visitantes.anonimo), true)
    })
  }
})

describe("SEAL-P2-01 — estado efetivo DEPOIS da correção", () => {
  const depois = estadoEfetivo([FASE_A, CORRECAO])

  for (const bucket of ["avatars", "pets"]) {
    it(`${bucket}: anônimo NÃO lista nem lê pela API (nenhum SELECT o autoriza)`, () => {
      assert.equal(podeVer(depois, bucket, visitantes.anonimo), false)
    })

    it(`${bucket}: outro usuário autenticado NÃO lista a pasta alheia`, () => {
      assert.equal(podeVer(depois, bucket, visitantes.outro), false)
    })

    it(`${bucket}: o dono autenticado mantém SELECT na própria pasta (remove() exige delete + select)`, () => {
      assert.equal(podeVer(depois, bucket, visitantes.dono), true)
    })

    it(`${bucket}: o dono continua com DELETE na própria pasta`, () => {
      const deletes = depois.filter((p) => p.comando === "DELETE" && /'(avatars|pets)'/.test(p.usando ?? ""))
      const ctx = { bucket, name: `${DONO}/foto.jpg`, ...visitantes.dono }
      assert.ok(deletes.some((p) => avaliar(p.usando, ctx)))
    })
  }

  it("as duas policies abertas deixaram de existir", () => {
    const nomes = depois.map((p) => p.nome)
    assert.equal(nomes.includes("Public read access for avatars"), false)
    assert.equal(nomes.includes("pets: public read specific"), false)
  })

  it("buckets privados continuam sem nenhuma leitura para anônimo", () => {
    for (const bucket of ["care-media", "care-media-video", "documents"]) {
      assert.equal(podeVer(depois, bucket, visitantes.anonimo), false, bucket)
    }
  })
})

describe("SEAL-P2-01 — a correção é mínima e não destrutiva", () => {
  const codigo = semComentarios(ler(CORRECAO))

  it("é transacional", () => {
    assert.match(codigo, /^\s*BEGIN;/)
    assert.match(codigo, /COMMIT;\s*$/)
  })

  it("não toca dados nem configuração de bucket", () => {
    assert.doesNotMatch(codigo, /\b(DELETE\s+FROM|UPDATE\s+storage|INSERT\s+INTO|TRUNCATE)\b/i)
    assert.doesNotMatch(codigo, /storage\.?"?buckets/i)
  })

  it("só declara policies de SELECT, para avatars e pets", () => {
    const criadas = policiesDe(ler(CORRECAO))
    assert.deepEqual(criadas.map((p) => p.nome).sort(), ["avatars: owner read", "pets: owner read"])
    for (const p of criadas) assert.equal(p.comando, "SELECT")
  })
})
