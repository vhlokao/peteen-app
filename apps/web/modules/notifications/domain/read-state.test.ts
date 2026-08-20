/**
 * Testes da regra pura da central de notificações — estado de leitura, badge
 * e probe barato (PRE-PILOT — NOTIFICATION CENTER RELIABILITY & UX).
 *
 * Rodar: npm run test:notification-read
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  applyReadState,
  buildBellAriaLabel,
  buildNotificationProbeToken,
  countUnread,
  formatBadgeCount,
  isKeyOwnedByFeed,
  shouldProbeNotifications,
  shouldRefreshNotifications,
  unreadKeysToPersist,
  NOTIFICATION_PROBE_COOLDOWN_MS,
  NOTIFICATION_PROBE_INTERVAL_MS,
  type NotificationProbeSource,
  type NotificationProbeState,
} from "./read-state.ts"
import type { NotificationItem } from "./types.ts"

const T0 = 1_000_000

function item(id: string, overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id,
    type: "request_accepted",
    title: "Solicitação aceita",
    description: "O profissional aceitou sua solicitação.",
    createdAt: new Date("2026-08-20T12:00:00.000Z"),
    href: "/tutor/requests/abc",
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read / unread
// ─────────────────────────────────────────────────────────────────────────────

describe("applyReadState — ausência de linha = não lida", () => {
  it("sem nenhuma chave lida, TODOS os itens ficam unread", () => {
    const resultado = applyReadState([item("a"), item("b")], new Set())
    assert.deepEqual(resultado.map((i) => i.isRead), [false, false])
  })

  it("linha existente marca o item correspondente como lido", () => {
    const resultado = applyReadState([item("a"), item("b")], new Set(["a"]))
    assert.deepEqual(resultado.map((i) => i.isRead), [true, false])
  })

  it("chave de leitura que não corresponde a nenhum item não afeta nada", () => {
    // É o caso de um evento que saiu do feed (soft delete, janela de 30 dias):
    // a linha em notification_reads continua existindo e simplesmente não é
    // usada — não pode quebrar nem marcar o item errado.
    const resultado = applyReadState([item("a")], new Set(["fantasma", "a"]))
    assert.deepEqual(resultado.map((i) => i.isRead), [true])
  })

  it("não muta os itens de entrada", () => {
    const entrada = [item("a")]
    applyReadState(entrada, new Set(["a"]))
    assert.equal(entrada[0]!.isRead, undefined)
  })

  it("feed vazio devolve lista vazia, sem lançar", () => {
    assert.deepEqual(applyReadState([], new Set(["x"])), [])
  })
})

describe("countUnread", () => {
  it("conta apenas os não lidos", () => {
    const itens = applyReadState([item("a"), item("b"), item("c")], new Set(["b"]))
    assert.equal(countUnread(itens), 2)
  })

  it("tudo lido → zero", () => {
    const itens = applyReadState([item("a"), item("b")], new Set(["a", "b"]))
    assert.equal(countUnread(itens), 0)
  })

  it("feed vazio → zero", () => {
    assert.equal(countUnread([]), 0)
  })
})

describe("unreadKeysToPersist — 'marcar todas' só escreve o que falta", () => {
  it("devolve só as chaves ainda não lidas", () => {
    const itens = applyReadState([item("a"), item("b"), item("c")], new Set(["b"]))
    assert.deepEqual(unreadKeysToPersist(itens).sort(), ["a", "c"])
  })

  it("tudo já lido → nada a persistir (idempotência: segunda chamada é no-op)", () => {
    const itens = applyReadState([item("a")], new Set(["a"]))
    assert.deepEqual(unreadKeysToPersist(itens), [])
  })
})

describe("isKeyOwnedByFeed — autorização de 'marcar uma'", () => {
  const feed = [item("notif-tutor-accepted-req1"), item("notif-tutor-care-cu1")]

  it("aceita chave que pertence ao feed derivado do usuário", () => {
    assert.equal(isKeyOwnedByFeed(feed, "notif-tutor-accepted-req1"), true)
  })

  it("REJEITA chave arbitrária inventada pelo cliente", () => {
    assert.equal(isKeyOwnedByFeed(feed, "notif-tutor-accepted-request-de-outro"), false)
  })

  it("REJEITA string vazia e chaves quase-iguais (sem prefix match acidental)", () => {
    assert.equal(isKeyOwnedByFeed(feed, ""), false)
    assert.equal(isKeyOwnedByFeed(feed, "notif-tutor-accepted-req"), false)
    assert.equal(isKeyOwnedByFeed(feed, "notif-tutor-accepted-req11"), false)
  })

  it("feed vazio rejeita qualquer chave — usuário sem notificações não marca nada", () => {
    assert.equal(isKeyOwnedByFeed([], "notif-tutor-accepted-req1"), false)
  })

  it("isolamento A/B: o feed de A nunca autoriza uma chave só presente no de B", () => {
    const feedA = [item("notif-tutor-accepted-reqA")]
    const feedB = [item("notif-tutor-accepted-reqB")]
    assert.equal(isKeyOwnedByFeed(feedA, feedB[0]!.id), false)
    assert.equal(isKeyOwnedByFeed(feedB, feedA[0]!.id), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────────────────

describe("formatBadgeCount — contrato do badge", () => {
  it("zero → null (badge não renderiza; nunca um '0' que lê como pendência)", () => {
    assert.equal(formatBadgeCount(0), null)
  })

  it("negativo (defensivo) também não renderiza", () => {
    assert.equal(formatBadgeCount(-1), null)
  })

  it("1 a 9 → número exato", () => {
    for (let n = 1; n <= 9; n++) {
      assert.equal(formatBadgeCount(n), String(n))
    }
  })

  it("acima de 9 → '9+'", () => {
    assert.equal(formatBadgeCount(10), "9+")
    assert.equal(formatBadgeCount(47), "9+")
  })
})

describe("buildBellAriaLabel — novidade não depende só do badge visual", () => {
  it("sem não lidas, rótulo simples", () => {
    assert.equal(buildBellAriaLabel(0), "Notificações")
  })

  it("singular e plural corretos", () => {
    assert.equal(buildBellAriaLabel(1), "Notificações, 1 não lida")
    assert.equal(buildBellAriaLabel(3), "Notificações, 3 não lidas")
  })

  it("anuncia o número EXATO mesmo quando o badge mostra '9+'", () => {
    // Truncar para leitor de tela seria perder informação sem ganho de espaço.
    assert.equal(formatBadgeCount(42), "9+")
    assert.equal(buildBellAriaLabel(42), "Notificações, 42 não lidas")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Probe
// ─────────────────────────────────────────────────────────────────────────────

function source(overrides: Partial<NotificationProbeSource> = {}): NotificationProbeSource {
  return {
    latestActivityAt: new Date("2026-08-20T12:00:00.000Z"),
    activityCount: 3,
    readCount: 0,
    ...overrides,
  }
}

describe("buildNotificationProbeToken — determinístico, barato, sem PII", () => {
  it("mesma fonte produz o mesmo token", () => {
    assert.equal(buildNotificationProbeToken(source()), buildNotificationProbeToken(source()))
  })

  it("evento novo (timestamp avança) muda o token", () => {
    assert.notEqual(
      buildNotificationProbeToken(source()),
      buildNotificationProbeToken(
        source({ latestActivityAt: new Date("2026-08-20T12:05:00.000Z") })
      )
    )
  })

  it("REMOÇÃO muda o token mesmo sem o timestamp avançar", () => {
    // Um CareUpdate soft-deletado sai do feed sem mover nenhum updatedAt para
    // frente. Sem a contagem, a tela seguiria mostrando um item que já não é
    // verdade — é exatamente por isso que activityCount entra no token.
    assert.notEqual(
      buildNotificationProbeToken(source({ activityCount: 3 })),
      buildNotificationProbeToken(source({ activityCount: 2 }))
    )
  })

  it("marcar como lida muda o token (outra aba do mesmo usuário percebe)", () => {
    // Nenhuma tabela de origem muda ao marcar leitura — só notification_reads.
    assert.notEqual(
      buildNotificationProbeToken(source({ readCount: 0 })),
      buildNotificationProbeToken(source({ readCount: 1 }))
    )
  })

  it("fonte vazia (usuário sem nada) produz token estável, sem lançar", () => {
    const vazio = source({ latestActivityAt: null, activityCount: 0, readCount: 0 })
    assert.equal(buildNotificationProbeToken(vazio), "-|0|0")
  })

  it("token não contém PII — só ISO date, dígitos e separador", () => {
    const token = buildNotificationProbeToken(source({ activityCount: 12, readCount: 5 }))
    assert.match(token, /^[0-9TZ:.\-]+\|\d+\|\d+$/)
  })
})

describe("shouldRefreshNotifications", () => {
  it("primeira leitura (previousToken null) NUNCA sincroniza sozinha", () => {
    assert.equal(shouldRefreshNotifications(null, "qualquer"), false)
  })

  it("token igual → 0 refresh", () => {
    assert.equal(shouldRefreshNotifications("tok-A", "tok-A"), false)
  })

  it("token diferente → exatamente 1 refresh; repetir o mesmo não dispara de novo", () => {
    assert.equal(shouldRefreshNotifications("tok-A", "tok-B"), true)
    // Após sincronizar, o token novo vira referência — sem loop.
    assert.equal(shouldRefreshNotifications("tok-B", "tok-B"), false)
  })
})

describe("shouldProbeNotifications — gate do probe", () => {
  function state(overrides: Partial<NotificationProbeState> = {}): NotificationProbeState {
    return {
      documentVisible: true,
      isProbing: false,
      lastAttemptAt: null,
      ...overrides,
    }
  }

  it("aba visível, nada em voo, sem cooldown → sonda nos 3 gatilhos", () => {
    for (const trigger of ["interval", "focus", "visible"] as const) {
      assert.equal(shouldProbeNotifications(trigger, state(), T0), true)
    }
  })

  it("aba oculta → nunca sonda (nada de polling em background)", () => {
    assert.equal(shouldProbeNotifications("interval", state({ documentVisible: false }), T0), false)
  })

  it("probe em voo → não duplica", () => {
    assert.equal(shouldProbeNotifications("focus", state({ isProbing: true }), T0), false)
  })

  it("rajada focus+visibility colapsa em UM probe", () => {
    assert.equal(shouldProbeNotifications("visible", state({ lastAttemptAt: null }), T0), true)
    assert.equal(
      shouldProbeNotifications("focus", state({ lastAttemptAt: T0 }), T0 + 50),
      false
    )
  })

  it("no limite exato do cooldown já libera", () => {
    assert.equal(
      shouldProbeNotifications("interval", state({ lastAttemptAt: T0 }), T0 + NOTIFICATION_PROBE_COOLDOWN_MS - 1),
      false
    )
    assert.equal(
      shouldProbeNotifications("interval", state({ lastAttemptAt: T0 }), T0 + NOTIFICATION_PROBE_COOLDOWN_MS),
      true
    )
  })

  it("nunca lança, em nenhuma combinação de flags e gatilhos", () => {
    for (const documentVisible of [true, false]) {
      for (const isProbing of [true, false]) {
        for (const lastAttemptAt of [null, T0 - 100_000, T0]) {
          for (const trigger of ["interval", "focus", "visible"] as const) {
            assert.doesNotThrow(() => {
              const r = shouldProbeNotifications(
                trigger,
                { documentVisible, isProbing, lastAttemptAt },
                T0
              )
              assert.equal(typeof r, "boolean")
            })
          }
        }
      }
    }
  })
})

describe("cadência", () => {
  it("probe roda a cada 10s, e o cooldown é bem menor que o intervalo", () => {
    assert.equal(NOTIFICATION_PROBE_INTERVAL_MS, 10_000)
    assert.ok(NOTIFICATION_PROBE_COOLDOWN_MS < NOTIFICATION_PROBE_INTERVAL_MS)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Fluxo composto — o que a tela realmente faz
// ─────────────────────────────────────────────────────────────────────────────

describe("fluxo: abrir → clicar em um → marcar todas", () => {
  const feed = [item("k1"), item("k2"), item("k3")]

  it("abrir a central NÃO marca nada como lido", () => {
    // Nenhuma escrita acontece na abertura: o estado é puramente o que
    // notification_reads já tinha. É a razão de não existir `seenAt`.
    const aoAbrir = applyReadState(feed, new Set())
    assert.equal(countUnread(aoAbrir), 3)
    assert.deepEqual(unreadKeysToPersist(aoAbrir).sort(), ["k1", "k2", "k3"])
  })

  it("clicar em um item marca APENAS aquele", () => {
    const depoisDoClique = applyReadState(feed, new Set(["k2"]))
    assert.equal(countUnread(depoisDoClique), 2)
    assert.equal(depoisDoClique.find((i) => i.id === "k2")!.isRead, true)
    assert.equal(depoisDoClique.find((i) => i.id === "k1")!.isRead, false)
  })

  it("marcar todas zera o contador e o badge some", () => {
    const antes = applyReadState(feed, new Set(["k2"]))
    const persistir = unreadKeysToPersist(antes)
    assert.deepEqual(persistir.sort(), ["k1", "k3"])

    const depois = applyReadState(feed, new Set(["k1", "k2", "k3"]))
    assert.equal(countUnread(depois), 0)
    assert.equal(formatBadgeCount(countUnread(depois)), null)
  })

  it("um evento NOVO chegando depois de 'marcar todas' nasce unread", () => {
    const lidas = new Set(["k1", "k2", "k3"])
    const comNovo = applyReadState([...feed, item("k4")], lidas)
    assert.equal(countUnread(comNovo), 1)
    assert.equal(formatBadgeCount(countUnread(comNovo)), "1")
  })
})
