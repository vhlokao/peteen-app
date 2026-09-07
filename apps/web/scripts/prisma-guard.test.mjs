/**
 * GATE-18 — guard dos comandos de schema do Prisma.
 *
 * O que estes testes protegem, concretamente: hoje `apps/web/.env` contém uma
 * connection string REMOTA, e `prisma.config.ts` resolve a URL do CLI a partir
 * dela. Ou seja, `npm run db:push` e `npm run db:migrate` alcançam um banco
 * remoto por padrão. O guard existe para que isso exija confirmação explícita,
 * e estes testes existem para que o guard não vire enfeite.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { avaliarComando, argsParaPrisma, ehLocal, ehProducao, REFS_DE_PRODUCAO } from "./prisma-guard.mjs"

/** Monta URLs em runtime: literal de connection string vira achado do scanner. */
const url = (host, usuario = "postgres") =>
  ["postgresql://", usuario, ":", "senha-de-teste", "@", host, ":5432/postgres"].join("")

const REMOTO = "db.abcdefghijklmnopqrst.supabase.co"
const REF_REMOTA = "abcdefghijklmnopqrst"

describe("banco local não ganha atrito", () => {
  // `[::1]` com colchetes é como IPv6 aparece numa URL — e é como `new URL()`
  // devolve o hostname. Sem normalizar, o guard barraria um banco local.
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    it(`${host} é liberado sem --target`, () => {
      const r = avaliarComando({ databaseUrl: url(host), argv: [], comando: "db push" })
      assert.equal(r.permitido, true, `${host} deveria passar`)
      assert.equal(r.local, true)
    })
  }

  it("ehLocal aceita IPv6 com e sem colchetes", () => {
    assert.equal(ehLocal("[::1]"), true)
    assert.equal(ehLocal("::1"), true)
  })

  it("ehLocal não confunde um host que apenas CONTÉM 'localhost'", () => {
    // `localhost.evil.com` não é local. Comparação exata, não substring.
    assert.equal(ehLocal("localhost.evil.com"), false)
    assert.equal(ehLocal("localhost"), true)
  })
})

describe("banco remoto exige confirmação explícita", () => {
  it("sem --target → BLOQUEADO", () => {
    const r = avaliarComando({ databaseUrl: url(REMOTO), argv: [], comando: "db push" })
    assert.equal(r.permitido, false)
    assert.match(r.motivo, /BLOQUEADO/)
    // A mensagem precisa dizer QUAL banco, senão não dá para confirmar com segurança.
    assert.match(r.motivo, new RegExp(REF_REMOTA))
  })

  it("com --target correto → permitido", () => {
    const r = avaliarComando({
      databaseUrl: url(REMOTO),
      argv: [`--target=${REF_REMOTA}`],
      comando: "db push",
    })
    assert.equal(r.permitido, true)
    assert.equal(r.local, false)
  })

  it("com --target de OUTRO banco → BLOQUEADO", () => {
    // O caso que importa: o .env foi trocado e o operador não percebeu.
    const r = avaliarComando({
      databaseUrl: url(REMOTO),
      argv: ["--target=outra-ref-qualquer"],
      comando: "migrate dev",
    })
    assert.equal(r.permitido, false)
    assert.match(r.motivo, /NÃO é o banco configurado/)
  })

  it("a mensagem de bloqueio avisa que migrate dev pode resetar", () => {
    const r = avaliarComando({ databaseUrl: url(REMOTO), argv: [], comando: "migrate dev" })
    assert.match(r.motivo, /RESETAR/)
  })
})

describe("produção é bloqueio incondicional", () => {
  const REF_PROD = [...REFS_DE_PRODUCAO][0]
  const HOST_PROD = `db.${REF_PROD}.supabase.co`

  for (const comando of ["db push", "migrate dev"]) {
    it(`${comando} contra produção → BLOQUEADO mesmo SEM --target`, () => {
      const r = avaliarComando({ databaseUrl: url(HOST_PROD), argv: [], comando })
      assert.equal(r.permitido, false)
      assert.equal(r.producao, true)
      assert.match(r.motivo, /NUNCA roda contra PRODUÇÃO/)
    })

    it(`${comando} contra produção → BLOQUEADO mesmo COM --target CORRETO`, () => {
      // O ponto do gate: confirmar o destino não é permissão suficiente aqui.
      const r = avaliarComando({
        databaseUrl: url(HOST_PROD),
        argv: [`--target=${REF_PROD}`],
        comando,
      })
      assert.equal(r.permitido, false, "--target correto NÃO pode liberar produção")
      assert.equal(r.producao, true)
    })
  }

  it("bloqueia também na forma de pooler, com a ref dentro do usuário", () => {
    // `postgres.<ref>` é como o pooler do Supabase identifica o projeto.
    const r = avaliarComando({
      databaseUrl: url("aws-0-sa-east-1.pooler.supabase.com", `postgres.${REF_PROD}`),
      argv: [`--target=${REF_PROD}`],
      comando: "db push",
    })
    assert.equal(r.permitido, false)
    assert.equal(r.producao, true)
  })

  it("ehProducao pega a ref na string crua mesmo sem alvo decomposto", () => {
    assert.equal(ehProducao(`algo-${REF_PROD}-qualquer`, null), true)
    assert.equal(ehProducao("postgresql://x@db.outroprojeto.supabase.co:5432/d", null), false)
  })

  it("a mensagem aponta o caminho legítimo, em vez de só recusar", () => {
    const r = avaliarComando({ databaseUrl: url(HOST_PROD), argv: [], comando: "db push" })
    assert.match(r.motivo, /migrate deploy/)
    assert.match(r.motivo, /MIGRATION_DEPLOY_RUNBOOK/)
  })

  it("DEMO continua liberável com --target — o bloqueio é só de produção", () => {
    const r = avaliarComando({
      databaseUrl: url(REMOTO),
      argv: [`--target=${REF_REMOTA}`],
      comando: "db push",
    })
    assert.equal(r.permitido, true, "bloquear tudo faria o guard ser contornado")
  })
})

describe("falha fechada", () => {
  for (const [rotulo, valor] of [
    ["ausente", undefined],
    ["vazia", ""],
    ["não é URL", "isto-não-é-uma-url"],
  ]) {
    it(`URL ${rotulo} → BLOQUEADO, nunca liberado`, () => {
      const r = avaliarComando({ databaseUrl: valor, argv: [], comando: "db push" })
      assert.equal(r.permitido, false, "não saber o destino nunca pode virar permissão")
    })
  }
})

describe("repasse de argumentos", () => {
  it("--target não vaza para o Prisma, que o rejeitaria", () => {
    assert.deepEqual(
      argsParaPrisma(["--accept-data-loss", `--target=${REF_REMOTA}`, "--skip-generate"]),
      ["--accept-data-loss", "--skip-generate"]
    )
  })
})
