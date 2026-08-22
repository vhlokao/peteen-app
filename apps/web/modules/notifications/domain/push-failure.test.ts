/**
 * Classificação de falha, política de retry e diagnóstico de entrega.
 *
 * O teste mais importante deste arquivo é o de que uma falha de CONFIGURAÇÃO
 * (401/403) não revoga subscription — foi exatamente esse tipo de erro que
 * produziu o incidente real de 2026-08-15 (`http_403`), e tratá-lo como
 * "aparelho morto" teria derrubado o push de usuários por um problema nosso.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  acumularFalha,
  classifyPushFailure,
  decidirRetry,
  DELIVERY_DIAGNOSTIC_MAX_LENGTH,
  diagnosticoVazio,
  ehSubscriptionMorta,
  formatDeliveryDiagnostic,
  parseDeliveryDiagnostic,
  PUSH_MAX_RETRY_ATTEMPTS,
  PUSH_RETRY_DEADLINE_MS,
  temFalha,
} from "./push-failure.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Classificação
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyPushFailure", () => {
  it("401 e 403 são configuração — problema NOSSO, não do aparelho", () => {
    assert.equal(classifyPushFailure(401), "configuration")
    assert.equal(classifyPushFailure(403), "configuration")
  })

  it("429 e 5xx são transitórios", () => {
    for (const c of [429, 500, 502, 503, 504]) {
      assert.equal(classifyPushFailure(c), "transient", `status ${c}`)
    }
  })

  it("sem resposta (rede/timeout) é transitório", () => {
    assert.equal(classifyPushFailure(null), "transient")
  })

  it("404/410 e demais 4xx são permanentes", () => {
    for (const c of [400, 404, 410, 413, 422]) {
      assert.equal(classifyPushFailure(c), "permanent", `status ${c}`)
    }
  })
})

describe("ehSubscriptionMorta — a única autoridade sobre revogar", () => {
  it("SÓ 404 e 410", () => {
    assert.equal(ehSubscriptionMorta(404), true)
    assert.equal(ehSubscriptionMorta(410), true)
  })

  it("403 NÃO revoga, ainda que seja falha", () => {
    // A regressão cara: um sender mal configurado (ou de outro ambiente)
    // derrubaria o push de todo mundo que ele tentasse alcançar.
    assert.equal(ehSubscriptionMorta(403), false)
    assert.equal(ehSubscriptionMorta(401), false)
  })

  it("permanente ≠ morta: 413 é permanente e NÃO revoga", () => {
    // Payload grande demais é defeito nosso; a subscription está viva. Derivar
    // a revogação de `classe === "permanent"` revogaria em massa por um bug de
    // payload.
    assert.equal(classifyPushFailure(413), "permanent")
    assert.equal(ehSubscriptionMorta(413), false)
  })

  it("timeout não revoga", () => {
    assert.equal(ehSubscriptionMorta(null), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Retry
// ─────────────────────────────────────────────────────────────────────────────

describe("decidirRetry", () => {
  it("só transitório é elegível", () => {
    for (const classe of ["permanent", "configuration"] as const) {
      const d = decidirRetry({ classe, tentativasFeitas: 1, decorridoMs: 0 })
      assert.equal(d.retry, false)
      assert.equal(d.retry === false && d.motivo, "classe_nao_elegivel")
    }
  })

  it("transitório retenta com backoff crescente", () => {
    const a = decidirRetry({ classe: "transient", tentativasFeitas: 1, decorridoMs: 100 })
    const b = decidirRetry({ classe: "transient", tentativasFeitas: 2, decorridoMs: 500 })
    assert.equal(a.retry, true)
    assert.equal(b.retry, true)
    assert.ok(a.retry && b.retry && b.esperarMs > a.esperarMs, "backoff deve crescer")
  })

  it("para depois do teto de tentativas", () => {
    const d = decidirRetry({
      classe: "transient",
      tentativasFeitas: PUSH_MAX_RETRY_ATTEMPTS + 1,
      decorridoMs: 100,
    })
    assert.equal(d.retry, false)
    assert.equal(d.retry === false && d.motivo, "tentativas_esgotadas")
  })

  it("o PRAZO corta antes do teto — é o que limita o pior caso", () => {
    // Dois timeouts de 3s já estouram o orçamento da Server Action. O prazo
    // existe para que o retry ajude no caso rápido sem punir o caso lento.
    const d = decidirRetry({
      classe: "transient",
      tentativasFeitas: 1,
      decorridoMs: PUSH_RETRY_DEADLINE_MS,
    })
    assert.equal(d.retry, false)
    assert.equal(d.retry === false && d.motivo, "prazo_esgotado")
  })

  it("falha rápida consome todas as tentativas dentro do prazo", () => {
    let tentativas = 1
    let decorrido = 100
    let reenvios = 0
    for (;;) {
      const d = decidirRetry({ classe: "transient", tentativasFeitas: tentativas, decorridoMs: decorrido })
      if (!d.retry) break
      reenvios++
      decorrido += d.esperarMs + 100
      tentativas++
    }
    assert.equal(reenvios, PUSH_MAX_RETRY_ATTEMPTS)
    assert.ok(decorrido < PUSH_RETRY_DEADLINE_MS, "caso rápido não deve estourar o prazo")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Diagnóstico — telemetria sem migration
// ─────────────────────────────────────────────────────────────────────────────

describe("diagnóstico de entrega", () => {
  it("ida e volta preserva tudo", () => {
    const d = { transient: 2, configuration: 1, permanent: 3, retries: 4, last: "http_503" }
    assert.deepEqual(parseDeliveryDiagnostic(formatDeliveryDiagnostic(d)), d)
  })

  it("sem último erro também faz ida e volta", () => {
    const d = { transient: 0, configuration: 0, permanent: 0, retries: 2, last: null }
    assert.deepEqual(parseDeliveryDiagnostic(formatDeliveryDiagnostic(d)), d)
  })

  it("cabe no VARCHAR(120) mesmo com erro absurdamente longo", () => {
    const s = formatDeliveryDiagnostic({
      transient: 99,
      configuration: 99,
      permanent: 99,
      retries: 99,
      last: "x".repeat(500),
    })
    assert.ok(s.length <= DELIVERY_DIAGNOSTIC_MAX_LENGTH, `tamanho ${s.length}`)
  })

  it("truncar sacrifica o erro, nunca os contadores", () => {
    const s = formatDeliveryDiagnostic({
      transient: 7,
      configuration: 0,
      permanent: 0,
      retries: 1,
      last: "y".repeat(500),
    })
    // Os números precisam sobreviver íntegros: um dígito perdido corromperia a
    // contagem em silêncio, enquanto um código truncado continua legível.
    const lido = parseDeliveryDiagnostic(s)
    assert.equal(lido?.transient, 7)
    assert.equal(lido?.retries, 1)
  })

  it("lastError legado (texto livre) devolve null, não zeros", () => {
    // Distinguir "linha antiga" de "entrega sem falha" — zeros mentiriam.
    assert.equal(parseDeliveryDiagnostic("http_403"), null)
    assert.equal(parseDeliveryDiagnostic("sender_threw: boom"), null)
    assert.equal(parseDeliveryDiagnostic(null), null)
    assert.equal(parseDeliveryDiagnostic(""), null)
  })

  it("distingue as três classes que antes eram indistinguíveis", () => {
    // Era o buraco de telemetria: transitório e configuração caíam ambos em
    // `failedCount` e ninguém sabia qual tinha acontecido.
    let d = diagnosticoVazio()
    d = acumularFalha(d, { classe: "transient", codigo: "http_503", retries: 2 })
    d = acumularFalha(d, { classe: "configuration", codigo: "http_403", retries: 0 })
    const lido = parseDeliveryDiagnostic(formatDeliveryDiagnostic(d))
    assert.equal(lido?.transient, 1)
    assert.equal(lido?.configuration, 1)
    assert.equal(lido?.permanent, 0)
    assert.equal(lido?.retries, 2)
    assert.equal(lido?.last, "http_403")
  })

  it("acumular é imutável", () => {
    const inicial = diagnosticoVazio()
    acumularFalha(inicial, { classe: "transient", codigo: "x", retries: 5 })
    assert.deepEqual(inicial, diagnosticoVazio())
  })

  it("temFalha ignora retries que terminaram em sucesso", () => {
    assert.equal(temFalha({ ...diagnosticoVazio(), retries: 3 }), false)
    assert.equal(temFalha({ ...diagnosticoVazio(), configuration: 1 }), true)
  })
})
