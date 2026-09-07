#!/usr/bin/env node
/**
 * Guard para comandos do Prisma que ESCREVEM schema — GATE-18.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE A AUDITORIA ENCONTROU
 *
 * `prisma.config.ts` resolve a URL do CLI assim:
 *
 *   url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]
 *
 * e carrega `dotenv/config`, que lê `apps/web/.env`. Esse arquivo, hoje, contém
 * uma connection string REMOTA. Consequência medida, não suposta:
 *
 *   npm run db:push     → `prisma db push`     contra um banco REMOTO
 *   npm run db:migrate  → `prisma migrate dev` contra um banco REMOTO
 *
 * `migrate dev` é um comando de DESENVOLVIMENTO: ele cria shadow database e,
 * ao detectar drift, se oferece para RESETAR o banco. Apontado para um banco
 * compartilhado, é perda de dados a uma tecla de distância. E como
 * `.env.prod-cutover.local` existe neste repositório, já houve pelo menos uma
 * vez em que alguém trocou essas variáveis para produção.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A REGRA
 *
 *   banco local (localhost/127.0.0.1/::1) → livre, sem cerimônia
 *   banco remoto + --target=<ref> correto → executa
 *   banco remoto sem --target             → BLOQUEADO
 *
 * A assimetria é deliberada. O fluxo de desenvolvimento contra banco local não
 * deve ganhar atrito nenhum: atrito onde não há risco é o que faz as pessoas
 * contornarem o guard. O atrito fica exatamente onde o dano é irreversível.
 *
 * Confirmação por REFERÊNCIA do projeto, não por allowlist no repositório —
 * mesma decisão de `scripts/lib/target-db-guard.mjs`, cuja função de
 * identificação este arquivo reaproveita em vez de reimplementar. Duas
 * implementações da mesma pergunta divergem no dia em que uma for corrigida.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE GUARD NÃO É A ESTRATÉGIA DE DEPLOY
 *
 * Ele impede um acidente; não define como schema chega em produção. Isso está
 * em `docs/MIGRATION_DEPLOY_RUNBOOK.md`, e a regra de lá continua valendo:
 * `db push` NUNCA é mecanismo de deploy de PROD, com ou sem confirmação.
 */
import { spawnSync } from "node:child_process"
import { identificarAlvo } from "./lib/target-db-guard.mjs"

/** Hosts que não precisam de confirmação: não há o que destruir de outro. */
const LOCAIS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"])

/**
 * Comparação EXATA (`localhost.evil.com` não é local), depois de remover os
 * colchetes que `new URL()` mantém em endereços IPv6: numa URL, o loopback v6
 * é escrito entre colchetes, e `hostname` devolve `[::1]` — com eles. Sem esta
 * normalização o guard exigiria confirmação para um banco na própria máquina,
 * e atrito onde não há risco é o que faz as pessoas contornarem o guard.
 */
export function ehLocal(host) {
  return LOCAIS.has(String(host).toLowerCase().replace(/^\[|\]$/g, ""))
}

/**
 * Decide se o comando pode seguir.
 * Devolve `{ permitido: true, alvo, local }` ou `{ permitido: false, motivo }`.
 * Função pura — é o que torna o guard testável sem tocar em banco nenhum.
 */
export function avaliarComando({ databaseUrl, argv, comando }) {
  const alvo = identificarAlvo(databaseUrl)

  if (!alvo) {
    return {
      permitido: false,
      motivo:
        `Não foi possível identificar o banco de destino de \`prisma ${comando}\`.\n` +
        "DIRECT_URL/DATABASE_URL ausente ou irreconhecível. Recusando por segurança.",
    }
  }

  if (ehLocal(alvo.host)) return { permitido: true, alvo, local: true }

  const flag = argv.find((a) => a.startsWith("--target="))
  const informado = flag ? flag.slice("--target=".length).trim() : ""

  if (!informado) {
    return {
      permitido: false,
      motivo: [
        `BLOQUEADO: \`prisma ${comando}\` alteraria um banco REMOTO.`,
        "",
        `  destino: ${alvo.host}  (ref: ${alvo.ref})`,
        "",
        "Se isto é mesmo o que você quer, confirme o destino explicitamente:",
        `  npm run ${comando === "db push" ? "db:push" : "db:migrate"} -- --target=${alvo.ref}`,
        "",
        "Antes disso, considere:",
        "  • `prisma migrate dev` pode RESETAR o banco ao detectar drift;",
        "  • `prisma db push` aplica schema sem gerar migration nem histórico;",
        "  • nenhum dos dois é mecanismo de deploy — ver docs/MIGRATION_DEPLOY_RUNBOOK.md.",
      ].join("\n"),
    }
  }

  if (informado !== alvo.ref && informado !== alvo.host) {
    return {
      permitido: false,
      motivo: [
        "BLOQUEADO: o destino confirmado NÃO é o banco configurado.",
        `  confirmado : ${informado}`,
        `  configurado: ${alvo.ref} (${alvo.host})`,
        "",
        "Isto normalmente significa que o .env aponta para outro ambiente.",
      ].join("\n"),
    }
  }

  return { permitido: true, alvo, local: false }
}

/** Remove as flags do guard antes de repassar para o Prisma, que as rejeitaria. */
export function argsParaPrisma(argv) {
  return argv.filter((a) => !a.startsWith("--target="))
}

// ── execução ────────────────────────────────────────────────────────────────
// Só roda quando invocado como script; importado por teste, não executa nada.
const executadoDiretamente =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())

if (executadoDiretamente) {
  const [, , ...resto] = process.argv
  const comando = resto[0] === "db" ? "db push" : "migrate dev"
  const argv = resto.slice(comando === "db push" ? 2 : 2)

  await import("dotenv/config")
  const databaseUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]

  const veredito = avaliarComando({ databaseUrl, argv, comando })

  if (!veredito.permitido) {
    console.error(`\n${veredito.motivo}\n`)
    process.exit(1)
  }

  console.error(
    veredito.local
      ? `[prisma-guard] destino local (${veredito.alvo.host}) — liberado.`
      : `[prisma-guard] destino remoto CONFIRMADO: ${veredito.alvo.ref} (${veredito.alvo.host}).`
  )

  const args = comando === "db push" ? ["db", "push"] : ["migrate", "dev"]
  const r = spawnSync("npx", ["prisma", ...args, ...argsParaPrisma(argv)], {
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  process.exit(r.status ?? 1)
}
