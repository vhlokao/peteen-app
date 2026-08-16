/**
 * R2B.3 — contrato de notificações do atendimento.
 *
 * Arquivo separado de push-events.test.ts de propósito: aquele cobre a
 * Foundation (sanitização de rota, classificação de status, marca do payload);
 * este cobre o CONTRATO DE EVENTOS — quais eventos existem, que copy cada um
 * tem, como as chaves são formadas e como a janela anti-spam de care_update se
 * comporta.
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildEventKey,
  buildPushPayload,
  CARE_UPDATE_PUSH_WINDOW_MS,
  careUpdatePushBucket,
  copyPareceInterpolada,
  PUSH_FALLBACK_URL,
  PUSH_NOTIFICATION_KINDS,
} from "./push-events.ts"

const KINDS_R2B3 = [
  "service_started",
  "care_update",
  "service_completed",
  "request_cancelled_by_tutor",
  "request_cancelled_by_professional",
] as const

const T = (iso: string) => new Date(iso)

// ─────────────────────────────────────────────────────────────────────────────
// Kinds e copy
// ─────────────────────────────────────────────────────────────────────────────

describe("R2B.3 — kinds do contrato", () => {
  it("todos os kinds novos estão registrados", () => {
    for (const kind of KINDS_R2B3) {
      assert.ok(
        (PUSH_NOTIFICATION_KINDS as readonly string[]).includes(kind),
        `kind ausente: ${kind}`
      )
    }
  })

  it("os kinds já existentes foram preservados", () => {
    for (const kind of ["smoke", "request_created", "request_accepted"] as const) {
      assert.ok((PUSH_NOTIFICATION_KINDS as readonly string[]).includes(kind))
    }
  })

  it("item J — conclusão NÃO reutiliza a copy de aceite", () => {
    const aceite = buildPushPayload("request_accepted", "/tutor/requests/r1")
    const conclusao = buildPushPayload("service_completed", "/tutor/requests/r1")
    assert.notEqual(aceite.title, conclusao.title)
    assert.notEqual(aceite.body, conclusao.body)
    assert.ok(!/aceit/i.test(conclusao.body), "copy de conclusão fala em aceite")
    assert.ok(!/aceit/i.test(conclusao.title), "título de conclusão fala em aceite")
  })

  it("início NÃO reutiliza a copy de aceite nem a de conclusão", () => {
    const inicio = buildPushPayload("service_started", "/tutor/requests/r1")
    const aceite = buildPushPayload("request_accepted", "/tutor/requests/r1")
    const conclusao = buildPushPayload("service_completed", "/tutor/requests/r1")
    assert.notEqual(inicio.body, aceite.body)
    assert.notEqual(inicio.body, conclusao.body)
    assert.ok(!/aceit/i.test(inicio.body), "copy de início fala em aceite")
  })

  it("todos os cinco kinds novos têm copy distinta entre si", () => {
    const corpos = KINDS_R2B3.map((k) => buildPushPayload(k, "/").body)
    assert.equal(new Set(corpos).size, KINDS_R2B3.length, "há copy duplicada entre kinds")
  })

  it("os dois cancelamentos distinguem o ator, sem interpolar nome", () => {
    const porTutor = buildPushPayload("request_cancelled_by_tutor", "/requests/r1")
    const porProfissional = buildPushPayload(
      "request_cancelled_by_professional",
      "/tutor/requests/r1"
    )
    assert.notEqual(porTutor.body, porProfissional.body)
    assert.equal(copyPareceInterpolada(porTutor.body), false)
    assert.equal(copyPareceInterpolada(porProfissional.body), false)
  })

  it("care_update não vaza conteúdo do Diário — copy genérica e constante", () => {
    const a = buildPushPayload("care_update", "/tutor/requests/r1/diario")
    const b = buildPushPayload("care_update", "/tutor/requests/r2/diario")
    assert.equal(a.body, b.body, "copy varia por request — sinal de interpolação")
    for (const texto of [a.title, a.body]) {
      assert.ok(!/foto|imagem|http|storage|url|assinad/i.test(texto), `vazamento em: ${texto}`)
    }
  })

  it("care_update tem tag própria — não substitui lifecycle na bandeja do SO", () => {
    const care = buildPushPayload("care_update", "/tutor/requests/r1/diario")
    const concluido = buildPushPayload("service_completed", "/tutor/requests/r1")
    assert.notEqual(care.tag, concluido.tag)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// eventKeys
// ─────────────────────────────────────────────────────────────────────────────

describe("R2B.3 — eventKeys", () => {
  it("eventos únicos por request", () => {
    assert.equal(buildEventKey("service-started", "req_1"), "service-started:req_1")
    assert.equal(buildEventKey("service-completed", "req_1"), "service-completed:req_1")
  })

  it("cancelamento inclui o ator — dois eventos logicamente distintos", () => {
    assert.notEqual(
      buildEventKey("request-cancelled", "req_1", "tutor"),
      buildEventKey("request-cancelled", "req_1", "professional")
    )
  })

  it("itens B/K — a chave é estável: reexecutar o mesmo evento repete a chave", () => {
    // É isso que faz o unique de PushDelivery descartar o retry (P2002) sem
    // segundo envio. Nenhum componente aleatório ou temporal entra aqui.
    assert.equal(
      buildEventKey("service-started", "req_1"),
      buildEventKey("service-started", "req_1")
    )
    assert.equal(
      buildEventKey("service-completed", "req_1"),
      buildEventKey("service-completed", "req_1")
    )
  })

  it("chaves de requests diferentes nunca colidem", () => {
    assert.notEqual(
      buildEventKey("service-started", "req_1"),
      buildEventKey("service-started", "req_2")
    )
  })

  it("os tipos de evento não colidem entre si na mesma request", () => {
    const chaves = [
      buildEventKey("service-request-created", "req_1"),
      buildEventKey("service-request-accepted", "req_1"),
      buildEventKey("service-started", "req_1"),
      buildEventKey("service-completed", "req_1"),
      buildEventKey("request-cancelled", "req_1", "tutor"),
      buildEventKey("request-cancelled", "req_1", "professional"),
    ]
    assert.equal(new Set(chaves).size, chaves.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Anti-spam de care_update — janela de 1 hora
// ─────────────────────────────────────────────────────────────────────────────

describe("R2B.3 — anti-spam de care_update (janela de 1h)", () => {
  const chaveEm = (iso: string, requestId = "req_1") =>
    buildEventKey("care-update", requestId, String(careUpdatePushBucket(T(iso))))

  it("a janela é de exatamente 1 hora", () => {
    assert.equal(CARE_UPDATE_PUSH_WINDOW_MS, 60 * 60 * 1000)
  })

  it("itens D/E — cenário da missão: 14:02 notifica, 14:10 e 14:37 não", () => {
    const k1 = chaveEm("2026-08-16T14:02:00.000Z")
    const k2 = chaveEm("2026-08-16T14:10:00.000Z")
    const k3 = chaveEm("2026-08-16T14:37:00.000Z")
    // Mesma chave ⇒ o segundo e o terceiro colidem no unique e não enviam.
    assert.equal(k1, k2)
    assert.equal(k1, k3)
  })

  it("item F — 15:03 abre janela nova e volta a ser elegível", () => {
    assert.notEqual(chaveEm("2026-08-16T14:37:00.000Z"), chaveEm("2026-08-16T15:03:00.000Z"))
  })

  it("item 15 — rajada de 5 updates em poucos minutos colapsa em UMA chave", () => {
    const rajada = [
      "2026-08-16T14:00:10.000Z",
      "2026-08-16T14:01:00.000Z",
      "2026-08-16T14:02:30.000Z",
      "2026-08-16T14:05:00.000Z",
      "2026-08-16T14:09:59.000Z",
    ].map((iso) => chaveEm(iso))

    assert.equal(new Set(rajada).size, 1, "rajada deveria colapsar em 1 push")
  })

  it("item G — nem careUpdateId nem contagem de fotos entram na chave", () => {
    // Uma publicação é UMA intenção de notificação, com 1 ou com 3 fotos.
    const chave = chaveEm("2026-08-16T14:00:00.000Z")
    assert.match(chave, /^care-update:req_1:\d+$/)
    assert.ok(!chave.includes("cu_"), "chave carrega id de CareUpdate")
  })

  it("requests distintas na mesma janela não compartilham chave", () => {
    const a = chaveEm("2026-08-16T14:00:00.000Z", "req_1")
    const b = chaveEm("2026-08-16T14:00:00.000Z", "req_2")
    assert.notEqual(a, b)
  })

  it("bucket é determinístico — mesma entrada, mesma saída", () => {
    const t = T("2026-08-16T14:30:00.000Z")
    assert.equal(careUpdatePushBucket(t), careUpdatePushBucket(new Date(t.getTime())))
  })

  it("bucket é monotônico no tempo", () => {
    assert.ok(
      careUpdatePushBucket(T("2026-08-16T15:00:00.000Z")) >
        careUpdatePushBucket(T("2026-08-16T14:00:00.000Z"))
    )
  })

  it("a borda da hora separa buckets consecutivos", () => {
    const fim = careUpdatePushBucket(T("2026-08-16T14:59:59.999Z"))
    const inicio = careUpdatePushBucket(T("2026-08-16T15:00:00.000Z"))
    assert.equal(inicio, fim + 1)
  })

  it("a chave cabe no limite de VARCHAR(200) mesmo com cuid longo", () => {
    const chave = buildEventKey(
      "care-update",
      "cmsvst9yb00008wsclcxv6j67",
      String(careUpdatePushBucket(new Date()))
    )
    assert.ok(chave.length < 200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Deep links por persona
// ─────────────────────────────────────────────────────────────────────────────

describe("R2B.3 — deep links", () => {
  it("care_update aponta para o Diário, não para a Request", () => {
    const p = buildPushPayload("care_update", "/tutor/requests/req_1/diario")
    assert.equal(p.url, "/tutor/requests/req_1/diario")
  })

  it("item N — cancelamento pelo tutor leva o PROFISSIONAL à árvore dele", () => {
    const p = buildPushPayload("request_cancelled_by_tutor", "/requests/req_1")
    assert.equal(p.url, "/requests/req_1")
    assert.ok(!p.url.startsWith("/tutor/"), "profissional caiu na rota do tutor")
  })

  it("item N — cancelamento pelo profissional leva o TUTOR à árvore dele", () => {
    const p = buildPushPayload("request_cancelled_by_professional", "/tutor/requests/req_1")
    assert.equal(p.url, "/tutor/requests/req_1")
  })

  it("rota externa continua neutralizada em todos os kinds novos", () => {
    for (const kind of KINDS_R2B3) {
      assert.equal(buildPushPayload(kind, "https://evil.example/x").url, PUSH_FALLBACK_URL)
      assert.equal(buildPushPayload(kind, "/\\evil.example").url, PUSH_FALLBACK_URL)
      assert.equal(buildPushPayload(kind, "//evil.example").url, PUSH_FALLBACK_URL)
    }
  })
})
