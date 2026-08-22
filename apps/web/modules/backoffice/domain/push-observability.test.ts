/**
 * Backoffice — leitura operacional de entregas de push.
 *
 * O teste que mais importa aqui é o de VOCABULÁRIO: nenhum rótulo pode afirmar
 * que o usuário recebeu ou viu a notificação. `acceptedCount` significa que o
 * push service aceitou a mensagem, e confundir isso com entrega foi a causa
 * raiz de uma investigação inteira desta base.
 *
 * Rodar: npm run test:backoffice
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import {
  exigeAtencao,
  lerEntregaPush,
  PUSH_DELIVERY_OUTCOMES,
  PUSH_OUTCOME_HINTS,
  PUSH_OUTCOME_LABELS,
  resumirEndpointHash,
  resumirFingerprint,
  rotularRevogacao,
  type PushDeliveryFacts,
} from "./push-observability.ts"

const ZERO: PushDeliveryFacts = {
  attemptedCount: 0,
  acceptedCount: 0,
  failedCount: 0,
  invalidCount: 0,
  lastError: null,
}

const fatos = (p: Partial<PushDeliveryFacts>): PushDeliveryFacts => ({ ...ZERO, ...p })

// ─────────────────────────────────────────────────────────────────────────────
// Classificação
// ─────────────────────────────────────────────────────────────────────────────

describe("lerEntregaPush — classificação", () => {
  it("aceito pelo provedor", () => {
    const r = lerEntregaPush(fatos({ attemptedCount: 1, acceptedCount: 1 }))
    assert.equal(r.outcome, "ACCEPTED_BY_PROVIDER")
    assert.equal(r.parcial, false)
  })

  it("attempted=0 é SEM APARELHO ELEGÍVEL, nunca falha", () => {
    // Contrato explícito do dispatcher. Contar isto como falha inflaria
    // justamente a métrica que deveria denunciar problema real.
    const r = lerEntregaPush(ZERO)
    assert.equal(r.outcome, "NO_ELIGIBLE_DEVICE")
    assert.equal(exigeAtencao(r), false)
  })

  it("configuração vence permanente e transitória na mesma entrega", () => {
    // É a única classe que exige alguém da equipe agir — precisa aparecer.
    const r = lerEntregaPush(
      fatos({ attemptedCount: 3, failedCount: 3, lastError: "t=1 c=1 p=1 r=2 last=http_403" })
    )
    assert.equal(r.outcome, "CONFIGURATION_FAILURE")
    assert.equal(exigeAtencao(r), true)
  })

  it("transitória isolada", () => {
    const r = lerEntregaPush(
      fatos({ attemptedCount: 1, failedCount: 1, lastError: "t=1 c=0 p=0 r=2 last=http_503" })
    )
    assert.equal(r.outcome, "TRANSIENT_FAILURE")
    assert.equal(r.retries, 2)
    // Instabilidade de canal não é acionável pela equipe.
    assert.equal(exigeAtencao(r), false)
  })

  it("permanente por invalidCount, mesmo sem diagnóstico (linha legada)", () => {
    const r = lerEntregaPush(fatos({ attemptedCount: 1, invalidCount: 1, lastError: "http_410" }))
    assert.equal(r.outcome, "PERMANENT_FAILURE")
  })

  it("falha legada sem diagnóstico é marcada como tal, não inventada", () => {
    // `lastError` em texto livre é anterior ao formato estruturado. Chutar uma
    // classe aqui produziria telemetria falsa sobre o passado.
    const r = lerEntregaPush(fatos({ attemptedCount: 1, failedCount: 1, lastError: "http_403" }))
    assert.equal(r.outcome, "UNCLASSIFIED_FAILURE")
    assert.equal(r.diagnostico, null)
    assert.equal(r.retries, null)
  })

  it("reenvio que terminou em sucesso é aceite, não falha", () => {
    const r = lerEntregaPush(
      fatos({ attemptedCount: 1, acceptedCount: 1, lastError: "t=0 c=0 p=0 r=2" })
    )
    assert.equal(r.outcome, "ACCEPTED_BY_PROVIDER")
    assert.equal(r.retries, 2)
    assert.equal(r.parcial, false)
  })

  it("entrega parcial é sinalizada nos dois sentidos", () => {
    // Sem `parcial`, o badge esconderia metade do que aconteceu: dizer "aceito"
    // apaga o aparelho que ficou sem; dizer "falha" apaga o que recebeu.
    const r = lerEntregaPush(
      fatos({
        attemptedCount: 2,
        acceptedCount: 1,
        failedCount: 1,
        lastError: "t=0 c=1 p=0 r=0 last=http_403",
      })
    )
    assert.equal(r.outcome, "CONFIGURATION_FAILURE")
    assert.equal(r.parcial, true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TESTE CENTRAL — vocabulário
// ─────────────────────────────────────────────────────────────────────────────

describe("nenhum rótulo afirma entrega ao usuário", () => {
  const VOCABULARIO_DE_ENTREGA =
    /\brecebeu\b|\brecebida\b|\brecebido\b|entregue ao usu|\bvisualizou\b|\bleu\b|\bexibiu\b/i

  /**
   * O que se procura é AFIRMAÇÃO de entrega, não a palavra solta.
   *
   * O aviso correto — "não é prova de que o aparelho exibiu" — contém
   * justamente o vocabulário proibido, e proibi-lo cru puniria o texto que faz
   * a coisa certa. Frases negadas são descartadas antes da checagem; o que
   * sobra é o que o rótulo AFIRMA.
   */
  function afirmaEntrega(texto: string): boolean {
    return texto
      .split(/(?<=[.!?])\s+/)
      .filter((frase) => !/\bn[ãa]o\b|\bnunca\b|≠/i.test(frase))
      .some((frase) => VOCABULARIO_DE_ENTREGA.test(frase))
  }

  it("labels não usam vocabulário de recebimento", () => {
    for (const [chave, label] of Object.entries(PUSH_OUTCOME_LABELS)) {
      assert.ok(!afirmaEntrega(label), `${chave} afirma entrega: "${label}"`)
    }
  })

  it("hints não usam vocabulário de recebimento", () => {
    for (const [chave, hint] of Object.entries(PUSH_OUTCOME_HINTS)) {
      assert.ok(!afirmaEntrega(hint), `${chave} afirma entrega: "${hint}"`)
    }
  })

  it("a checagem pega uma afirmação de verdade", () => {
    // Trava do próprio teste: sem isto, o filtro de negação poderia ser
    // afrouxado até não pegar mais nada e ninguém notaria.
    assert.equal(afirmaEntrega("O usuário recebeu a notificação."), true)
    assert.equal(afirmaEntrega("Não é prova de que o aparelho exibiu."), false)
  })

  it("o rótulo de aceite diz explicitamente que não é prova de exibição", () => {
    assert.match(PUSH_OUTCOME_HINTS.ACCEPTED_BY_PROVIDER, /não é prova/i)
  })

  it("todo outcome tem label e hint", () => {
    for (const o of PUSH_DELIVERY_OUTCOMES) {
      assert.ok(PUSH_OUTCOME_LABELS[o]?.length > 0, o)
      assert.ok(PUSH_OUTCOME_HINTS[o]?.length > 0, o)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Segredo / PII
// ─────────────────────────────────────────────────────────────────────────────

describe("mascaramento", () => {
  it("endpointHash sai cortado", () => {
    const hash = "a".repeat(64)
    const resumo = resumirEndpointHash(hash)
    assert.equal(resumo.length, 12)
    assert.ok(hash.startsWith(resumo))
  })

  it("fingerprint sai cortado e o legado é nomeado", () => {
    assert.equal(resumirFingerprint("b".repeat(64)).length, 8)
    assert.equal(resumirFingerprint(null), "legado")
  })

  it("motivos de revogação têm rótulo humano", () => {
    assert.equal(rotularRevogacao("gone"), "Morta na origem (404/410)")
    assert.equal(rotularRevogacao("user_optout"), "Desativado pelo usuário")
    assert.equal(rotularRevogacao(null), "—")
    // Motivo desconhecido não pode virar tela em branco.
    assert.equal(rotularRevogacao("motivo_futuro"), "motivo_futuro")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TRAVAS ESTRUTURAIS — segredo nunca sai do servidor
// ─────────────────────────────────────────────────────────────────────────────

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}
const ler = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"))

describe("travas de segredo no backoffice", () => {
  it("o repositório de push NUNCA seleciona endpoint, p256dh ou auth", () => {
    // Os três juntos permitem ENVIAR push para o aparelho de alguém. Um
    // backoffice que os exibisse transformaria uma captura de tela numa
    // credencial de envio.
    const fonte = ler("modules/backoffice/infrastructure/push-observability-repository.ts")
    for (const proibido of ["endpoint:", "p256dh", "auth:"]) {
      assert.ok(!fonte.includes(proibido), `seleciona segredo: ${proibido}`)
    }
    // `endpointHash` é permitido e esperado — é o que permite correlacionar.
    assert.ok(fonte.includes("endpointHash"))
  })

  it("a timeline operacional não lê conteúdo de Diário nem IP/userAgent", () => {
    const fonte = ler("modules/backoffice/infrastructure/request-timeline-repository.ts")
    for (const proibido of ["content:", "ipAddress", "userAgent", "before:", "after:"]) {
      assert.ok(!fonte.includes(proibido), `lê dado que não devia: ${proibido}`)
    }
  })

  it("toda leitura do repositório de push tem take explícito", () => {
    // Backoffice sem teto vira query gigante conforme a base cresce.
    const fonte = ler("modules/backoffice/infrastructure/push-observability-repository.ts")
    const findMany = (fonte.match(/findMany\(/g) ?? []).length
    const takes = (fonte.match(/take:/g) ?? []).length
    assert.ok(takes >= findMany, `${findMany} findMany para ${takes} take`)
  })

  it("as actions de push exigem admin antes de qualquer leitura", () => {
    const fonte = ler("modules/backoffice/application/push-observability-actions.ts")
    const guarda = fonte.indexOf("requireAdminOrRedirect()")
    const leitura = fonte.indexOf("getPushOverview()")
    assert.ok(guarda > 0, "sem guard de admin")
    assert.ok(guarda < leitura, "lê antes de autorizar")
  })
})
