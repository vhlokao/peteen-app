/**
 * Testes focados — funções puras de Push Foundation V0.
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/notifications/domain/push-events.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildEventKey,
  buildPushPayload,
  classifyPushStatus,
  copyPareceInterpolada,
  EVENT_KEY_MAX_LENGTH,
  InvalidEventKeyError,
  PUSH_FALLBACK_URL,
  PUSH_NOTIFICATION_KINDS,
  PUSH_SMOKE_URL,
  sanitizeInternalRoute,
  SMOKE_PAYLOAD,
} from "./push-events.ts"
import {
  CREATE_WINDOW_MS,
  MAX_ACTIVE_SUBSCRIPTIONS_PER_USER,
  MAX_CREATES_PER_WINDOW,
  PUSH_ERROR_CODES,
  REVOKED_REASONS,
} from "./push-types.ts"

// ─────────────────────────────────────────────────────────────────────────────
// buildEventKey — identidade lógica
// ─────────────────────────────────────────────────────────────────────────────

describe("buildEventKey", () => {
  it("monta o formato tipo:parte", () => {
    assert.equal(buildEventKey("request-created", "req_123"), "request-created:req_123")
    assert.equal(buildEventKey("request-accepted", "req_123"), "request-accepted:req_123")
    assert.equal(buildEventKey("care-update", "cu_9"), "care-update:cu_9")
  })

  it("suporta discriminador extra — o caso que a tupla (type, entityId) não cobre", () => {
    // A MESMA disputa gera notificações legítimas em estados diferentes.
    // Com chave opaca isso é natural; com a tupla exigiria poluir eventType
    // ou mentir sobre o conteúdo de entityId.
    const aberta = buildEventKey("dispute-status", "dsp_1", "OPEN")
    const resolvida = buildEventKey("dispute-status", "dsp_1", "RESOLVED")
    assert.equal(aberta, "dispute-status:dsp_1:OPEN")
    assert.notEqual(aberta, resolvida)
  })

  it("é determinístico — mesma entrada, mesma chave", () => {
    assert.equal(buildEventKey("request-created", "r1"), buildEventKey("request-created", "r1"))
  })

  it("entidades diferentes nunca colidem", () => {
    assert.notEqual(buildEventKey("request-created", "r1"), buildEventKey("request-created", "r2"))
  })

  it("rejeita ':' dentro das partes — evitaria colisão silenciosa", () => {
    // ["a:b","c"] e ["a","b:c"] virariam a MESMA string se ':' fosse aceito
    // dentro de uma parte, quebrando a idempotência sem nenhum sintoma.
    assert.throws(() => buildEventKey("t", "a:b"), InvalidEventKeyError)
    assert.throws(() => buildEventKey("t:x", "a"), InvalidEventKeyError)
  })

  it("rejeita partes vazias e ausência de partes", () => {
    assert.throws(() => buildEventKey("t", ""), InvalidEventKeyError)
    assert.throws(() => buildEventKey("t"), InvalidEventKeyError)
    assert.throws(() => buildEventKey("", "a"), InvalidEventKeyError)
  })

  it("rejeita chave acima do limite da coluna (VARCHAR 200)", () => {
    assert.throws(() => buildEventKey("t", "x".repeat(EVENT_KEY_MAX_LENGTH)), InvalidEventKeyError)
    // No limite exato, passa.
    const noLimite = buildEventKey("t", "x".repeat(EVENT_KEY_MAX_LENGTH - 2))
    assert.equal(noLimite.length, EVENT_KEY_MAX_LENGTH)
  })

  it("uma chave real com cuid fica muito abaixo do limite", () => {
    const key = buildEventKey("request-accepted", "cmqwmgbb0000c58scejvwxeu5")
    assert.ok(key.length < 60, `esperado < 60, veio ${key.length}`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// classifyPushStatus — aceite ≠ entrega
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyPushStatus", () => {
  it("2xx → accepted (aceite pelo push service, NÃO entrega ao device)", () => {
    assert.equal(classifyPushStatus(200), "accepted")
    assert.equal(classifyPushStatus(201), "accepted")
    assert.equal(classifyPushStatus(202), "accepted")
    assert.equal(classifyPushStatus(299), "accepted")
  })

  it("404 e 410 → invalid (subscription morta, revogar como gone)", () => {
    assert.equal(classifyPushStatus(404), "invalid")
    assert.equal(classifyPushStatus(410), "invalid")
  })

  it("demais erros → failed, nunca invalid", () => {
    // Crítico: 401/403 é VAPID errado e 429 é throttling. Tratar qualquer um
    // como "invalid" revogaria em massa subscriptions perfeitamente vivas.
    for (const code of [400, 401, 403, 413, 429, 500, 502, 503]) {
      assert.equal(classifyPushStatus(code), "failed", `status ${code}`)
    }
  })

  it("nunca retorna 'delivered' — não é observável por Web Push", () => {
    const possiveis = new Set(
      [200, 201, 404, 410, 400, 429, 500].map((c) => classifyPushStatus(c))
    )
    assert.deepEqual([...possiveis].sort(), ["accepted", "failed", "invalid"])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Copy segura — nada de PII na lockscreen
// ─────────────────────────────────────────────────────────────────────────────

describe("copy segura", () => {
  it("payload de smoke não contém marcador de interpolação", () => {
    assert.equal(copyPareceInterpolada(SMOKE_PAYLOAD.title), false)
    assert.equal(copyPareceInterpolada(SMOKE_PAYLOAD.body), false)
    assert.equal(copyPareceInterpolada(SMOKE_PAYLOAD.url), false)
  })

  it("detecta interpolação acidental — trava contra template string", () => {
    assert.equal(copyPareceInterpolada("Olá ${nome}"), true)
    assert.equal(copyPareceInterpolada("Pet: undefined"), true)
    assert.equal(copyPareceInterpolada("[object Object]"), true)
  })

  it("nenhum termo sensível na copy de smoke", () => {
    // Limite de palavra, não substring: a própria marca "Peteen" contém "pet".
    // Buscar substring daria falso positivo e treinaria a ignorar o teste —
    // pior que não ter teste.
    const proibidos = ["tutor", "pet", "pets", "telefone", "endereço", "preço", "disputa"]
    const texto = `${SMOKE_PAYLOAD.title} ${SMOKE_PAYLOAD.body}`.toLowerCase()
    for (const termo of proibidos) {
      const comoPalavra = new RegExp(`(^|[^a-zà-ú])${termo}([^a-zà-ú]|$)`, "i")
      assert.ok(!comoPalavra.test(texto), `copy não pode conter a palavra "${termo}"`)
    }
    // Valor monetário em qualquer forma.
    assert.ok(!/R\$|\d+,\d{2}/.test(texto), "copy não pode conter valor monetário")
  })

  it("url do payload é rota interna relativa — nunca absoluta", () => {
    assert.ok(SMOKE_PAYLOAD.url.startsWith("/"), "deve ser relativa")
    assert.ok(!SMOKE_PAYLOAD.url.startsWith("//"), "// seria protocol-relative externa")
    assert.equal(SMOKE_PAYLOAD.url, PUSH_SMOKE_URL)
  })

  it("payload tem exatamente as 4 chaves do tipo fechado", () => {
    assert.deepEqual(Object.keys(SMOKE_PAYLOAD).sort(), ["body", "tag", "title", "url"])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de contrato
// ─────────────────────────────────────────────────────────────────────────────

describe("constantes de contrato", () => {
  it("limites de rate limit são os aprovados", () => {
    assert.equal(MAX_ACTIVE_SUBSCRIPTIONS_PER_USER, 6)
    assert.equal(MAX_CREATES_PER_WINDOW, 10)
    assert.equal(CREATE_WINDOW_MS, 60 * 60 * 1000)
  })

  it("razões de revogação são as 4 aprovadas e cabem em VARCHAR(40)", () => {
    assert.deepEqual([...REVOKED_REASONS].sort(), [
      "account_cleanup",
      "gone",
      "logout",
      "user_optout",
    ])
    for (const r of REVOKED_REASONS) {
      assert.ok(r.length <= 40, `"${r}" excede VARCHAR(40)`)
    }
  })

  it("SUBSCRIPTION_CONFLICT existe e é genérico (sem vazar o dono)", () => {
    assert.ok(PUSH_ERROR_CODES.includes("SUBSCRIPTION_CONFLICT"))
    // O código não pode conter nada que revele a existência de outro usuário.
    for (const code of PUSH_ERROR_CODES) {
      assert.ok(!/user|owner|dono/i.test(code), `código "${code}" vaza semântica de dono`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeInternalRoute — correção do open redirect (Q1 da QA independente)
//
// A implementação antiga checava prefixos ("/" sim, "//" não). A QA comprovou
// que "/\evil.example" passava e o parser WHATWG resolvia para
// https://evil.example/. A matriz abaixo é a MESMA usada contra o sanitizer do
// service worker — as duas implementações precisam concordar.
// ─────────────────────────────────────────────────────────────────────────────

export const MATRIZ_URLS = {
  permitir: [
    { entrada: "/", esperado: "/" },
    { entrada: "/tutor", esperado: "/tutor" },
    { entrada: "/requests/abc", esperado: "/requests/abc" },
    { entrada: "/path?q=1#x", esperado: "/path?q=1#x" },
    { entrada: "/tutor/notifications", esperado: "/tutor/notifications" },
  ],
  bloquear: [
    "https://evil.example",
    "http://evil.example",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "\\\\evil.example",
    "/\\\\evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "  //evil.example",
    "\t//evil.example",
    "\n//evil.example",
    "https://evil.example/\\@peteen",
    "",
    "   ",
  ],
}

describe("sanitizeInternalRoute — parser, não prefixo", () => {
  it("permite rotas internas preservando path, query e hash", () => {
    for (const { entrada, esperado } of MATRIZ_URLS.permitir) {
      assert.equal(sanitizeInternalRoute(entrada), esperado, `entrada ${JSON.stringify(entrada)}`)
    }
  })

  it("bloqueia TODA tentativa de sair da origem — inclusive backslash", () => {
    for (const entrada of MATRIZ_URLS.bloquear) {
      assert.equal(
        sanitizeInternalRoute(entrada),
        PUSH_FALLBACK_URL,
        `entrada ${JSON.stringify(entrada)} deveria cair no fallback`
      )
    }
  })

  it("o bypass exato reportado pela QA está fechado", () => {
    // Regressão nomeada: este era o vetor comprovado de open redirect.
    assert.equal(sanitizeInternalRoute("/\\evil.example"), "/")
    assert.equal(sanitizeInternalRoute("/\\/evil.example"), "/")
  })

  it("saída NUNCA resolve para outra origem — verificado com o parser real", () => {
    const todas = [...MATRIZ_URLS.permitir.map((p) => p.entrada), ...MATRIZ_URLS.bloquear]
    for (const entrada of todas) {
      const saida = sanitizeInternalRoute(entrada)
      const resolvida = new URL(saida, "https://peteen.example")
      assert.equal(
        resolvida.origin,
        "https://peteen.example",
        `${JSON.stringify(entrada)} -> ${JSON.stringify(saida)} escapou para ${resolvida.origin}`
      )
    }
  })

  it("entradas não-string caem no fallback", () => {
    for (const v of [null, undefined, 123, {}, [], true]) {
      assert.equal(sanitizeInternalRoute(v), PUSH_FALLBACK_URL)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildPushPayload — contrato fechado (achado da QA independente)
// ─────────────────────────────────────────────────────────────────────────────

describe("buildPushPayload — payload fechado", () => {
  it("todo kind conhecido produz copy constante e sem interpolação", () => {
    for (const kind of PUSH_NOTIFICATION_KINDS) {
      const p = buildPushPayload(kind, "/tutor/notifications")
      assert.ok(p.title.length > 0, `${kind} sem title`)
      assert.ok(p.body.length > 0, `${kind} sem body`)
      assert.equal(copyPareceInterpolada(p.title), false, `${kind} title interpolado`)
      assert.equal(copyPareceInterpolada(p.body), false, `${kind} body interpolado`)
    }
  })

  it("caller NÃO controla title/body — nenhum argumento alcança a copy visível", () => {
    /**
     * A versão anterior deste teste checava `buildPushPayload.length === 2`:
     * "não existe terceiro parâmetro por onde injetar nome, pet ou telefone".
     *
     * GATE-13 acrescentou um terceiro parâmetro (`entityId`) que alimenta APENAS
     * a `tag` — chave de colapso do SO, nunca exibida. A aridade deixou de
     * expressar a garantia, então o teste passou a verificar a garantia
     * DIRETAMENTE, em vez do proxy: nenhum argumento, por mais hostil que seja,
     * muda o que aparece na lockscreen.
     */
    const hostil = "Rex do João — (11) 99999-0000, Rua X 123"
    for (const kind of PUSH_NOTIFICATION_KINDS) {
      const limpo = buildPushPayload(kind, "/tutor/requests/abc", "abc")
      const sujo = buildPushPayload(kind, "/tutor/requests/abc", hostil)

      // O texto visível é idêntico — o terceiro argumento não o alcança.
      assert.equal(sujo.title, limpo.title, kind)
      assert.equal(sujo.body, limpo.body, kind)

      // E não vaza para lugar nenhum que a pessoa leia.
      assert.ok(!sujo.title.includes("João"), kind)
      assert.ok(!sujo.body.includes("99999"), kind)
      assert.ok(!sujo.url.includes("João"), kind)
    }
  })

  it("o terceiro parâmetro só existe para escopar a tag", () => {
    const a = buildPushPayload("request_accepted", "/tutor/requests/A", "A")
    const b = buildPushPayload("request_accepted", "/tutor/requests/A", "B")
    // Mesma rota, mesmo kind: a ÚNICA diferença possível é a tag.
    assert.equal(a.title, b.title)
    assert.equal(a.body, b.body)
    assert.equal(a.url, b.url)
    assert.notEqual(a.tag, b.tag)
  })

  it("mesma kind sempre produz a MESMA copy, independente da rota", () => {
    const a = buildPushPayload("request_created", "/requests/abc")
    const b = buildPushPayload("request_created", "/requests/xyz")
    assert.equal(a.title, b.title)
    assert.equal(a.body, b.body)
    assert.notEqual(a.url, b.url)
  })

  it("rota maliciosa é neutralizada dentro da própria factory", () => {
    const p = buildPushPayload("request_created", "/\\evil.example")
    assert.equal(p.url, PUSH_FALLBACK_URL)
  })

  it("nenhuma copy de nenhum kind contém termo sensível", () => {
    const proibidos = ["tutor", "pet", "pets", "telefone", "endereço", "preço", "disputa"]
    for (const kind of PUSH_NOTIFICATION_KINDS) {
      const p = buildPushPayload(kind, "/")
      const texto = `${p.title} ${p.body}`.toLowerCase()
      for (const termo of proibidos) {
        const comoPalavra = new RegExp(`(^|[^a-zà-ú])${termo}([^a-zà-ú]|$)`, "i")
        assert.ok(!comoPalavra.test(texto), `${kind}: copy contém "${termo}"`)
      }
      assert.ok(!/R\$|\d+,\d{2}/.test(texto), `${kind}: copy contém valor monetário`)
    }
  })
})
