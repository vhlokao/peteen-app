/**
 * GATE-16-DEMO-STABILITY-FIX-002 — `--dry-run` é ZERO writes, provado.
 *
 * O gate anterior AFIRMOU isso e não verificou: eu conferi um único script
 * (`demo-cleanup-lote-f1`) e generalizei para os oito. Nos dois criadores não
 * havia desvio nenhum, então a ferramenta imprimia "nada será escrito" três
 * linhas antes de `auth.admin.createUser`.
 *
 * Aqui cada caminho é exercitado com espiões que REGISTRAM toda chamada. O
 * teste falha se qualquer método de escrita for invocado em dry-run — não é
 * asserção sobre o texto do código, é sobre o que a função faz.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { criarAdminIsolado } from "../create-isolated-admin.mjs"
import { criarPersonaSemente } from "./seed-persona.mjs"
import {
  EscritaEmDryRunError,
  protegerPrisma,
  protegerSupabaseAdmin,
} from "./dry-run-clients.mjs"

// ─────────────────────────────────────────────────────────────────────────────
// Espiões — registram tudo, escrevem nada
// ─────────────────────────────────────────────────────────────────────────────

const METODOS_DE_ESCRITA = [
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]

function criarPrismaEspiao({ usuarioExistente = null } = {}) {
  const chamadas = []
  const registrar = (nome) => (...args) => {
    chamadas.push({ metodo: nome, args })
    return Promise.resolve({ id: "id-falso" })
  }

  const delegate = (modelo) => {
    const alvo = {
      findUnique: (...args) => {
        chamadas.push({ metodo: `${modelo}.findUnique`, args })
        return Promise.resolve(usuarioExistente)
      },
      findMany: registrar(`${modelo}.findMany`),
      count: registrar(`${modelo}.count`),
    }
    for (const m of METODOS_DE_ESCRITA) alvo[m] = registrar(`${modelo}.${m}`)
    return alvo
  }

  const prisma = {
    user: delegate("user"),
    adminProfile: delegate("adminProfile"),
    tutorProfile: delegate("tutorProfile"),
    pet: delegate("pet"),
    $transaction: async (cb) => {
      chamadas.push({ metodo: "$transaction", args: [] })
      return cb(prisma)
    },
    $disconnect: async () => {},
  }
  return { prisma, chamadas }
}

function criarSupabaseEspiao() {
  const chamadas = []
  const registrar = (nome) => (...args) => {
    chamadas.push({ metodo: nome, args })
    return Promise.resolve({ data: { user: { id: "auth-falso" } }, error: null })
  }
  return {
    chamadas,
    client: {
      auth: {
        admin: {
          createUser: registrar("auth.admin.createUser"),
          deleteUser: registrar("auth.admin.deleteUser"),
          updateUserById: registrar("auth.admin.updateUserById"),
        },
      },
    },
  }
}

const ESCRITAS_PROIBIDAS = (chamadas) =>
  chamadas.filter(
    (c) =>
      c.metodo === "$transaction" ||
      c.metodo.startsWith("auth.admin.") ||
      METODOS_DE_ESCRITA.some((m) => c.metodo.endsWith(`.${m}`))
  )

const logSilencioso = { info() {}, error() {}, warn() {} }

// ─────────────────────────────────────────────────────────────────────────────
// create-isolated-admin
// ─────────────────────────────────────────────────────────────────────────────

describe("create-isolated-admin --dry-run não escreve nada", () => {
  it("nenhum método de escrita é chamado", async () => {
    const { prisma, chamadas } = criarPrismaEspiao()
    const supabase = criarSupabaseEspiao()

    const r = await criarAdminIsolado({
      prisma,
      supabaseAdmin: supabase.client,
      email: "admin.novo@peteen.test",
      dryRun: true,
      log: logSilencioso,
    })

    assert.equal(r.status, "plano")
    assert.deepEqual(ESCRITAS_PROIBIDAS(chamadas), [], "houve escrita no Prisma")
    assert.deepEqual(supabase.chamadas, [], "houve chamada à Admin API do Supabase")
  })

  it("consulta o estado atual — dry-run pode LER", async () => {
    const { prisma, chamadas } = criarPrismaEspiao()
    await criarAdminIsolado({
      prisma,
      supabaseAdmin: criarSupabaseEspiao().client,
      email: "admin.novo@peteen.test",
      dryRun: true,
      log: logSilencioso,
    })
    assert.ok(chamadas.some((c) => c.metodo === "user.findUnique"))
  })

  it("NÃO gera senha temporária em dry-run", async () => {
    let gerou = false
    await criarAdminIsolado({
      prisma: criarPrismaEspiao().prisma,
      supabaseAdmin: criarSupabaseEspiao().client,
      email: "admin.novo@peteen.test",
      dryRun: true,
      log: logSilencioso,
      gerarSenha: () => {
        gerou = true
        return "nao-deveria"
      },
    })
    assert.equal(gerou, false, "senha temporária foi gerada em dry-run")
  })

  it("nada do que é impresso em dry-run contém senha", async () => {
    const impresso = []
    await criarAdminIsolado({
      prisma: criarPrismaEspiao().prisma,
      supabaseAdmin: criarSupabaseEspiao().client,
      email: "admin.novo@peteen.test",
      dryRun: true,
      log: { info: (...a) => impresso.push(a.join(" ")), error: () => {} },
      gerarSenha: () => "SEGREDO-QUE-NAO-PODE-VAZAR",
    })
    const texto = impresso.join("\n")
    assert.ok(!texto.includes("SEGREDO-QUE-NAO-PODE-VAZAR"), texto)
    assert.match(texto, /PLANO/)
  })

  it("email já existente aborta sem escrever, mesmo fora de dry-run", async () => {
    const { prisma, chamadas } = criarPrismaEspiao({
      usuarioExistente: { id: "user-existente" },
    })
    const supabase = criarSupabaseEspiao()
    const r = await criarAdminIsolado({
      prisma,
      supabaseAdmin: supabase.client,
      email: "ja.existe@peteen.test",
      dryRun: false,
      log: logSilencioso,
    })
    assert.equal(r.status, "ja-existe")
    assert.deepEqual(ESCRITAS_PROIBIDAS(chamadas), [])
    assert.deepEqual(supabase.chamadas, [])
  })

  it("CONTROLE NEGATIVO: fora de dry-run, escreve mesmo", async () => {
    // Sem este caso, os testes acima passariam com uma função que nunca faz nada.
    const { prisma, chamadas } = criarPrismaEspiao()
    const supabase = criarSupabaseEspiao()
    await criarAdminIsolado({
      prisma,
      supabaseAdmin: supabase.client,
      email: "admin.novo@peteen.test",
      dryRun: false,
      log: logSilencioso,
      gerarSenha: () => "senha-de-teste",
    })
    assert.ok(supabase.chamadas.some((c) => c.metodo === "auth.admin.createUser"))
    assert.ok(chamadas.some((c) => c.metodo === "user.upsert"))
    assert.ok(chamadas.some((c) => c.metodo === "adminProfile.create"))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// create-seed-users
// ─────────────────────────────────────────────────────────────────────────────

describe("create-seed-users --dry-run não escreve nada", () => {
  const persona = (extra) => ({
    label: "TUTOR",
    email: "tutor.seed@peteen.test",
    senha: "senha-de-teste",
    activePrimaryRole: "TUTOR",
    criarRegistrosDaPersona: async (tx) => {
      await tx.tutorProfile.create({ data: {} })
      await tx.pet.create({ data: {} })
    },
    log: logSilencioso,
    ...extra,
  })

  it("nenhum método de escrita é chamado", async () => {
    const { prisma, chamadas } = criarPrismaEspiao()
    const supabase = criarSupabaseEspiao()

    const r = await criarPersonaSemente(
      persona({ prisma, supabaseAdmin: supabase.client, dryRun: true })
    )

    assert.equal(r.status, "plano")
    assert.deepEqual(ESCRITAS_PROIBIDAS(chamadas), [], "houve escrita no Prisma")
    assert.deepEqual(supabase.chamadas, [], "houve chamada à Admin API do Supabase")
  })

  it("os registros da persona NÃO chegam a ser construídos", async () => {
    // Eles vivem dentro da transação; se ela não abre, nada é criado.
    let construiu = false
    const { prisma } = criarPrismaEspiao()
    await criarPersonaSemente(
      persona({
        prisma,
        supabaseAdmin: criarSupabaseEspiao().client,
        dryRun: true,
        criarRegistrosDaPersona: async () => {
          construiu = true
        },
      })
    )
    assert.equal(construiu, false)
  })

  it("email já existente pula sem escrever", async () => {
    const { prisma, chamadas } = criarPrismaEspiao({
      usuarioExistente: { id: "ja-existe" },
    })
    const supabase = criarSupabaseEspiao()
    const r = await criarPersonaSemente(
      persona({ prisma, supabaseAdmin: supabase.client, dryRun: false })
    )
    assert.equal(r.status, "ja-existe")
    assert.deepEqual(ESCRITAS_PROIBIDAS(chamadas), [])
    assert.deepEqual(supabase.chamadas, [])
  })

  it("CONTROLE NEGATIVO: fora de dry-run, cria Auth + User + persona", async () => {
    const { prisma, chamadas } = criarPrismaEspiao()
    const supabase = criarSupabaseEspiao()
    const r = await criarPersonaSemente(
      persona({ prisma, supabaseAdmin: supabase.client, dryRun: false })
    )
    assert.equal(r.status, "criado")
    assert.ok(supabase.chamadas.some((c) => c.metodo === "auth.admin.createUser"))
    assert.ok(chamadas.some((c) => c.metodo === "user.upsert"))
    assert.ok(chamadas.some((c) => c.metodo === "tutorProfile.create"))
    assert.ok(chamadas.some((c) => c.metodo === "pet.create"))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A rede embaixo: mesmo com desvio esquecido, escrever é impossível
// ─────────────────────────────────────────────────────────────────────────────

describe("clientes protegidos — dry-run não depende de disciplina", () => {
  it("prisma protegido: leitura passa, escrita lança", async () => {
    const { prisma } = criarPrismaEspiao()
    const p = protegerPrisma(prisma, { dryRun: true })

    await p.user.findUnique({ where: { email: "x" } }) // não lança
    assert.throws(() => p.user.create({ data: {} }), EscritaEmDryRunError)
    assert.throws(() => p.user.upsert({}), EscritaEmDryRunError)
    assert.throws(() => p.adminProfile.create({}), EscritaEmDryRunError)
    assert.throws(() => p.pet.deleteMany({}), EscritaEmDryRunError)
  })

  it("o `tx` de dentro da transação também é protegido", async () => {
    const { prisma } = criarPrismaEspiao()
    const p = protegerPrisma(prisma, { dryRun: true })
    await assert.rejects(
      p.$transaction(async (tx) => {
        tx.tutorProfile.create({ data: {} })
      }),
      EscritaEmDryRunError
    )
  })

  it("supabase protegido: criar/apagar usuário lança", () => {
    const s = protegerSupabaseAdmin(criarSupabaseEspiao().client, { dryRun: true })
    assert.throws(() => s.auth.admin.createUser({}), EscritaEmDryRunError)
    assert.throws(() => s.auth.admin.deleteUser("x"), EscritaEmDryRunError)
    assert.throws(() => s.auth.admin.updateUserById("x", {}), EscritaEmDryRunError)
  })

  it("fora de dry-run os clientes passam intactos, sem indireção", () => {
    const { prisma } = criarPrismaEspiao()
    const supabase = criarSupabaseEspiao().client
    assert.equal(protegerPrisma(prisma, { dryRun: false }), prisma)
    assert.equal(protegerSupabaseAdmin(supabase, { dryRun: false }), supabase)
  })

  it("a mensagem do erro diz qual operação foi barrada e o que fazer", () => {
    try {
      protegerPrisma(criarPrismaEspiao().prisma, { dryRun: true }).user.create({})
      assert.fail("deveria ter lançado")
    } catch (err) {
      assert.equal(err.name, "EscritaEmDryRunError")
      assert.match(err.message, /prisma\.user\.create/)
      assert.match(err.message, /--target=/)
    }
  })
})
