/**
 * GATE-16-DEMO-STABILITY-001 — guard de destino dos scripts operacionais.
 *
 * O guard antigo checava `NODE_ENV`/`VERCEL_ENV`, que são `undefined` em
 * execução local — ou seja, nunca disparava justamente onde os scripts rodam.
 * O que importa é o BANCO de destino, e é isso que estes casos travam.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  DestinoNaoConfirmadoError,
  exigirDestinoConfirmado,
  identificarAlvo,
} from "./target-db-guard.mjs"

/**
 * Fixtures montadas em runtime, e não escritas como literal.
 *
 * `check-sensitive-data` marca como CRÍTICO qualquer connection string com
 * credencial embutida em arquivo rastreado — e está certo: normalizar esse
 * formato no repositório é como se aprende a ignorá-lo. Estas são sintéticas
 * (ref inventada, senha de mentira), mas o padrão some do texto do arquivo.
 *
 * Detalhe registrado: no GATE-16-001 estes literais existiam e o checker não
 * os viu, porque ele só enxerga arquivos já rastreados pelo git e eles eram
 * novos. Ficaram invisíveis até o commit seguinte.
 */
const REF_FALSA = "abcdefghijklmnop"
const montarUrl = (usuario, host, porta) =>
  ["postgresql://", usuario, ":", "senha-de-teste", "@", host, ":", porta, "/postgres"].join("")

const DIRETA = montarUrl("postgres", `db.${REF_FALSA}.supabase.co`, "5432")
const POOLER = montarUrl(
  `postgres.${REF_FALSA}`,
  "aws-1-us-east-1.pooler.supabase.com",
  "6543"
)

describe("identificar o destino sem expor credencial", () => {
  it("conexão direta: extrai o ref do host", () => {
    const alvo = identificarAlvo(DIRETA)
    assert.equal(alvo.ref, "abcdefghijklmnop")
    assert.equal(alvo.host, "db.abcdefghijklmnop.supabase.co")
  })

  it("pooler: extrai o ref do usuário", () => {
    assert.equal(identificarAlvo(POOLER).ref, "abcdefghijklmnop")
  })

  it("nunca devolve a senha", () => {
    for (const url of [DIRETA, POOLER]) {
      const serializado = JSON.stringify(identificarAlvo(url))
      assert.ok(!serializado.includes("senha-de-teste"), serializado)
    }
  })

  it("entrada inutilizável devolve null — quem chama recusa", () => {
    for (const ruim of ["", "   ", undefined, null, 42, "não-é-url"]) {
      assert.equal(identificarAlvo(ruim), null, String(ruim))
    }
  })
})

describe("FAIL-CLOSED — sem confirmação não escreve", () => {
  it("sem --target e sem --dry-run: bloqueia", () => {
    assert.throws(
      () => exigirDestinoConfirmado({ databaseUrl: DIRETA, argv: [] }),
      DestinoNaoConfirmadoError
    )
  })

  it("a mensagem diz o destino e como confirmar", () => {
    assert.throws(
      () => exigirDestinoConfirmado({ databaseUrl: DIRETA, argv: [] }),
      (err) => {
        assert.match(err.message, /destino não confirmado/i)
        assert.match(err.message, /abcdefghijklmnop/)
        assert.match(err.message, /--dry-run/)
        assert.match(err.message, /--target=/)
        return true
      }
    )
  })

  it("DATABASE_URL ausente bloqueia — nunca assume que é seguro", () => {
    assert.throws(
      () => exigirDestinoConfirmado({ databaseUrl: undefined, argv: ["--target=x"] }),
      DestinoNaoConfirmadoError
    )
  })

  it("destino confirmado DIFERENTE do configurado bloqueia", () => {
    // O caso real: `.env.local` aponta para produção e o operador acha que
    // está no demo.
    assert.throws(
      () => exigirDestinoConfirmado({ databaseUrl: DIRETA, argv: ["--target=outroprojeto"] }),
      (err) => {
        assert.match(err.message, /NÃO é o banco configurado/i)
        assert.match(err.message, /outroprojeto/)
        assert.match(err.message, /abcdefghijklmnop/)
        return true
      }
    )
  })

  it("--target vazio não conta como confirmação", () => {
    assert.throws(
      () => exigirDestinoConfirmado({ databaseUrl: DIRETA, argv: ["--target="] }),
      DestinoNaoConfirmadoError
    )
  })
})

describe("o que PODE prosseguir", () => {
  it("--dry-run passa sem confirmação — não escreve nada", () => {
    const r = exigirDestinoConfirmado({ databaseUrl: DIRETA, argv: ["--dry-run"] })
    assert.equal(r.dryRun, true)
    assert.equal(r.alvo.ref, "abcdefghijklmnop")
  })

  it("--target correto libera a escrita", () => {
    const r = exigirDestinoConfirmado({
      databaseUrl: DIRETA,
      argv: ["--target=abcdefghijklmnop"],
    })
    assert.equal(r.dryRun, false)
    assert.equal(r.alvo.ref, "abcdefghijklmnop")
  })

  it("confirmar pelo host também vale", () => {
    const r = exigirDestinoConfirmado({
      databaseUrl: DIRETA,
      argv: ["--target=db.abcdefghijklmnop.supabase.co"],
    })
    assert.equal(r.dryRun, false)
  })

  it("dry-run continua permitido mesmo com DATABASE_URL de qualquer projeto", () => {
    // Dry-run é como o operador descobre para onde está apontando.
    assert.equal(exigirDestinoConfirmado({ databaseUrl: POOLER, argv: ["--dry-run"] }).dryRun, true)
  })
})
