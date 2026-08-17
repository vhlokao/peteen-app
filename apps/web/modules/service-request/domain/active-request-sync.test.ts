/**
 * Testes da regra pura de auto-sync da Request ativa (R2B.2).
 *
 * Cobre os 10 cenários exigidos pela missão. Cada `it` está rotulado com o
 * número do item correspondente para rastreabilidade.
 *
 * Rodar: npm run test:active-request-sync
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  shouldSync,
  shouldRunPollTimer,
  shouldRefreshAfterProbe,
  buildRequestSyncToken,
  isRequestSyncActive,
  ACTIVE_REQUEST_SYNC_COOLDOWN_MS,
  type ActiveRequestSyncState,
  type RequestSyncSnapshotInput,
} from "./active-request-sync.ts"

const T0 = 1_000_000

function baseState(overrides: Partial<ActiveRequestSyncState> = {}): ActiveRequestSyncState {
  return {
    status: "IN_PROGRESS",
    documentVisible: true,
    hasInteraction: false,
    isRefreshing: false,
    lastAttemptAt: null,
    ...overrides,
  }
}

describe("isRequestSyncActive — deriva do enum real, sem lista paralela", () => {
  it("PENDING, ACCEPTED, IN_PROGRESS são ativos", () => {
    assert.equal(isRequestSyncActive("PENDING"), true)
    assert.equal(isRequestSyncActive("ACCEPTED"), true)
    assert.equal(isRequestSyncActive("IN_PROGRESS"), true)
  })

  it("todos os estados terminais reais são inativos — incluindo DISPUTED, sem tratamento especial", () => {
    assert.equal(isRequestSyncActive("COMPLETED"), false)
    assert.equal(isRequestSyncActive("CANCELLED_BY_TUTOR"), false)
    assert.equal(isRequestSyncActive("CANCELLED_BY_PROFESSIONAL"), false)
    assert.equal(isRequestSyncActive("EXPIRED"), false)
    assert.equal(isRequestSyncActive("DISPUTED"), false)
  })
})

describe("item 1 — status ativo → timer deveria existir", () => {
  it("ativo + visível → shouldRunPollTimer true", () => {
    assert.equal(shouldRunPollTimer("PENDING", true), true)
    assert.equal(shouldRunPollTimer("ACCEPTED", true), true)
    assert.equal(shouldRunPollTimer("IN_PROGRESS", true), true)
  })
})

describe("item 2 — status terminal → timer não deveria existir", () => {
  it("terminal, mesmo visível, nunca cria timer", () => {
    for (const status of ["COMPLETED", "CANCELLED_BY_TUTOR", "CANCELLED_BY_PROFESSIONAL", "EXPIRED", "DISPUTED"] as const) {
      assert.equal(shouldRunPollTimer(status, true), false, `${status} não deveria rodar timer`)
    }
  })

  it("terminal bloqueia especificamente o gatilho 'interval' — o único que o timer poderia produzir", () => {
    assert.equal(shouldSync("interval", baseState({ status: "COMPLETED" }), T0), false)
  })

  it("hardening pós-gate: terminal NÃO bloqueia foco/visibilidade — dados relacionados (disputa, review, Diário) podem mudar sem transição de status", () => {
    assert.equal(shouldSync("focus", baseState({ status: "COMPLETED" }), T0), true)
    assert.equal(shouldSync("visible", baseState({ status: "COMPLETED" }), T0), true)
  })
})

describe("item 3 — hidden → timer suspenso", () => {
  it("ativo mas não visível → shouldRunPollTimer false", () => {
    assert.equal(shouldRunPollTimer("IN_PROGRESS", false), false)
  })

  it("ativo mas não visível → shouldSync false mesmo sem nenhum outro impedimento", () => {
    assert.equal(shouldSync("interval", baseState({ documentVisible: false }), T0), false)
  })
})

describe("item 4 — visible (retorno) → refresh", () => {
  it("volta a ficar visível, ativo, sem interação/refresh/cooldown → sincroniza", () => {
    assert.equal(shouldSync("visible", baseState(), T0), true)
  })
})

describe("item 5 — focus → refresh", () => {
  it("gatilho focus nas mesmas condições → sincroniza", () => {
    assert.equal(shouldSync("focus", baseState(), T0), true)
  })
})

describe("item 6 — focus + visibility em rajada → no máximo 1 refresh", () => {
  it("segunda tentativa dentro do cooldown, após a primeira já ter carimbado lastAttemptAt, é recusada", () => {
    const primeira = shouldSync("visible", baseState({ lastAttemptAt: null }), T0)
    assert.equal(primeira, true)

    // O componente real carimba lastAttemptAt = T0 assim que shouldSync devolve
    // true (antes mesmo do router.refresh() resolver) — é isso que o teste
    // simula ao construir o segundo estado.
    const segunda = shouldSync(
      "focus",
      baseState({ lastAttemptAt: T0 }),
      T0 + 50 // focus chega 50ms depois, mesmo "instante" para fins de UX
    )
    assert.equal(segunda, false, "a segunda tentativa dentro da janela de cooldown deve ser recusada")
  })

  it("uma tentativa fora do cooldown volta a ser aceita", () => {
    const depoisDoCooldown = shouldSync(
      "interval",
      baseState({ lastAttemptAt: T0 }),
      T0 + ACTIVE_REQUEST_SYNC_COOLDOWN_MS + 1
    )
    assert.equal(depoisDoCooldown, true)
  })

  it("exatamente no limite do cooldown já é aceita (comparação estrita: '<', não '<=')", () => {
    // A janela precisa ter DECORRIDO por completo, não apenas se aproximado.
    // Um milissegundo antes do limite ainda bloqueia; no limite exato, a
    // condição de bloqueio (`delta < COOLDOWN`) deixa de valer.
    const umMsAntes = shouldSync(
      "interval",
      baseState({ lastAttemptAt: T0 }),
      T0 + ACTIVE_REQUEST_SYNC_COOLDOWN_MS - 1
    )
    assert.equal(umMsAntes, false, "1ms antes do limite ainda deve bloquear")

    const noLimite = shouldSync(
      "interval",
      baseState({ lastAttemptAt: T0 }),
      T0 + ACTIVE_REQUEST_SYNC_COOLDOWN_MS
    )
    assert.equal(noLimite, true, "no limite exato do cooldown já deve liberar")
  })
})

describe("item 7 — timer enquanto refresh em andamento → não duplica", () => {
  it("isRefreshing true bloqueia novo shouldSync, em qualquer gatilho", () => {
    for (const trigger of ["interval", "focus", "visible"] as const) {
      assert.equal(shouldSync(trigger, baseState({ isRefreshing: true }), T0), false)
    }
  })
})

describe("proteção de formulário — hasInteraction bloqueia sincronização", () => {
  it("interação local ativa impede refresh mesmo com tudo mais favorável", () => {
    assert.equal(shouldSync("interval", baseState({ hasInteraction: true }), T0), false)
  })

  it("ao interação terminar (false de novo), volta a sincronizar", () => {
    assert.equal(shouldSync("interval", baseState({ hasInteraction: false }), T0), true)
  })
})

describe("item 9 — mudança para terminal → timer removido", () => {
  it("simula a transição: ativo com timer, depois status vira terminal na mesma checagem", () => {
    assert.equal(shouldRunPollTimer("ACCEPTED", true), true)
    // Após um refresh trazer o novo status do servidor, a próxima chamada
    // usa o status atualizado — nenhum estado extra precisa ser limpo à mão
    // além do que shouldRunPollTimer já responde.
    assert.equal(shouldRunPollTimer("COMPLETED", true), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Hardening pós-gate — probe (token comparável) substitui refresh cego
// ─────────────────────────────────────────────────────────────────────────────

function snapshot(overrides: Partial<RequestSyncSnapshotInput> = {}): RequestSyncSnapshotInput {
  return {
    status: "IN_PROGRESS",
    requestUpdatedAt: new Date("2026-08-16T12:00:00.000Z"),
    dispute: null,
    review: null,
    latestCareUpdate: null,
    careUpdateCount: 0,
    ...overrides,
  }
}

describe("probe do Diário — detecta o que a timeline mostra", () => {
  const umaEntrada = { id: "cu_1", editedAt: null }

  it("nova CareUpdate publicada muda o token", () => {
    // O caso central: o tutor está com /diario aberto e o profissional publica.
    assert.notEqual(
      buildRequestSyncToken(snapshot({ latestCareUpdate: null, careUpdateCount: 0 })),
      buildRequestSyncToken(snapshot({ latestCareUpdate: umaEntrada, careUpdateCount: 1 }))
    )
  })

  it("edição de uma CareUpdate existente muda o token", () => {
    assert.notEqual(
      buildRequestSyncToken(snapshot({ latestCareUpdate: umaEntrada, careUpdateCount: 1 })),
      buildRequestSyncToken(snapshot({
        latestCareUpdate: { id: "cu_1", editedAt: new Date("2026-08-17T12:00:00.000Z") },
        careUpdateCount: 1,
      }))
    )
  })

  it("SOFT DELETE de uma entrada que não é a mais recente muda o token", () => {
    // Sem `careUpdateCount` este caso passava despercebido: `latestCareUpdate`
    // continua sendo a mesma e `requestUpdatedAt` não muda, então o Diário
    // aberto seguiria exibindo uma entrada já removida.
    const antes = snapshot({ latestCareUpdate: umaEntrada, careUpdateCount: 3 })
    const depois = snapshot({ latestCareUpdate: umaEntrada, careUpdateCount: 2 })
    assert.notEqual(buildRequestSyncToken(antes), buildRequestSyncToken(depois))
  })

  it("token IGUAL → nenhum refresh (item 16: token unchanged → 0 refresh)", () => {
    const t = buildRequestSyncToken(snapshot({ latestCareUpdate: umaEntrada, careUpdateCount: 1 }))
    assert.equal(shouldRefreshAfterProbe(t, t), false)
  })

  it("token DIFERENTE → exatamente um refresh (item 16: token changed → 1 refresh)", () => {
    const antes = buildRequestSyncToken(snapshot({ careUpdateCount: 1, latestCareUpdate: umaEntrada }))
    const depois = buildRequestSyncToken(snapshot({
      careUpdateCount: 2,
      latestCareUpdate: { id: "cu_2", editedAt: null },
    }))
    assert.equal(shouldRefreshAfterProbe(antes, depois), true)
    // Depois de sincronizar, o token novo vira referência: o MESMO estado não
    // pode disparar um segundo refresh.
    assert.equal(shouldRefreshAfterProbe(depois, depois), false)
  })

  it("formulário do profissional com rascunho impede qualquer probe", () => {
    // A proteção de draft acontece ANTES do probe — `hasInteraction` é o que
    // `formularioTemTrabalhoEmAndamento` alimenta no CareUpdateForm.
    const comRascunho = {
      status: "IN_PROGRESS" as const,
      documentVisible: true,
      hasInteraction: true,
      isRefreshing: false,
      lastAttemptAt: null,
    }
    assert.equal(shouldSync("interval", comRascunho, 1_000), false)
    assert.equal(shouldSync("focus", comRascunho, 1_000), false)
    assert.equal(shouldSync("visible", comRascunho, 1_000), false)
    // Sem rascunho, o mesmo estado sincroniza.
    assert.equal(shouldSync("interval", { ...comRascunho, hasInteraction: false }, 1_000), true)
  })
})

describe("buildRequestSyncToken — determinístico, sem PII", () => {
  it("dois snapshots idênticos produzem o mesmo token", () => {
    assert.equal(buildRequestSyncToken(snapshot()), buildRequestSyncToken(snapshot()))
  })

  it("a contagem entra no token sem expor conteúdo", () => {
    const t = buildRequestSyncToken(snapshot({ careUpdateCount: 7 }))
    assert.ok(t.endsWith("|7"))
  })

  it("status diferente produz token diferente", () => {
    assert.notEqual(
      buildRequestSyncToken(snapshot({ status: "IN_PROGRESS" })),
      buildRequestSyncToken(snapshot({ status: "COMPLETED" }))
    )
  })

  it("item E — nova disputa (id novo) produz token diferente, mesmo com status igual", () => {
    const antes = buildRequestSyncToken(snapshot({ dispute: null }))
    const depois = buildRequestSyncToken(
      snapshot({ dispute: { id: "d1", status: "OPEN", resolvedAt: null } })
    )
    assert.notEqual(antes, depois)
  })

  it("item E — nova review (id novo) produz token diferente, mesmo com status terminal igual", () => {
    const antes = buildRequestSyncToken(snapshot({ status: "COMPLETED", review: null }))
    const depois = buildRequestSyncToken(
      snapshot({
        status: "COMPLETED",
        review: { id: "r1", updatedAt: new Date("2026-08-16T13:00:00.000Z") },
      })
    )
    assert.notEqual(antes, depois)
  })

  it("novo CareUpdate (id novo) produz token diferente", () => {
    const antes = buildRequestSyncToken(snapshot({ latestCareUpdate: null }))
    const depois = buildRequestSyncToken(
      snapshot({ latestCareUpdate: { id: "c1", editedAt: null } })
    )
    assert.notEqual(antes, depois)
  })

  it("nenhum campo de PII (nome/telefone/conteúdo) participa da entrada — só ids, enums e datas", () => {
    const input = snapshot({
      dispute: { id: "d1", status: "OPEN", resolvedAt: null },
      review: { id: "r1", updatedAt: new Date() },
      latestCareUpdate: { id: "c1", editedAt: new Date() },
    })
    const chaves = Object.keys(input)
    // `careUpdateCount` é um inteiro — quantas entradas visíveis existem.
    // Não revela autor, texto, foto nem horário; entrou para detectar soft
    // delete, que nenhum dos outros campos captura.
    assert.deepEqual(chaves.sort(), [
      "careUpdateCount", "dispute", "latestCareUpdate", "requestUpdatedAt", "review", "status",
    ].sort())
  })

  it("o token é só ids opacos, enums, datas e um inteiro — nada legível", () => {
    // Trava de contrato: se alguém adicionar `content` ou `petName` ao
    // snapshot, o token passaria a trafegar isso a cada 20 segundos.
    const token = buildRequestSyncToken(
      snapshot({
        dispute: { id: "d1", status: "OPEN", resolvedAt: null },
        review: { id: "r1", updatedAt: new Date("2026-08-17T12:00:00.000Z") },
        latestCareUpdate: { id: "c1", editedAt: null },
        careUpdateCount: 2,
      })
    )
    assert.ok(!/[áéíóúâêôãõç\s]/i.test(token.replace(/[TZ]/g, "")))
  })
})

describe("shouldRefreshAfterProbe — decide router.refresh() a partir do token, não do timer/foco", () => {
  it("primeira leitura (previousToken null) nunca sincroniza sozinha — só estabelece a referência", () => {
    assert.equal(shouldRefreshAfterProbe(null, "qualquer-token"), false)
  })

  it("item G — token igual ao anterior → não sincroniza", () => {
    assert.equal(shouldRefreshAfterProbe("token-A", "token-A"), false)
  })

  it("item H — token diferente do anterior → sincroniza exatamente uma vez (true)", () => {
    assert.equal(shouldRefreshAfterProbe("token-A", "token-B"), true)
  })
})

// Item F (probe falho → router.refresh() não é chamado) não é testável de
// forma pura: a decisão de sequenciamento ("se !result.success, retorna
// cedo, nunca chega a chamar shouldRefreshAfterProbe") é da FIAÇÃO em
// ActiveRequestAutoRefresh.tsx, não da regra de domínio — o mesmo motivo
// pelo qual o projeto não roda testes de componente (sem jsdom). Verificado
// via QA ao vivo (queda de rede durante o probe).

describe("item 10 — robustez: shouldSync nunca lança, mesmo com combinações adversas", () => {
  it("todas as combinações de flags booleanas e os 3 gatilhos produzem um boolean, sem exceção", () => {
    const statuses: ActiveRequestSyncState["status"][] = [
      "PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED",
      "CANCELLED_BY_TUTOR", "CANCELLED_BY_PROFESSIONAL", "EXPIRED", "DISPUTED",
    ]
    const triggers = ["interval", "focus", "visible"] as const
    const bools = [true, false]

    for (const status of statuses) {
      for (const documentVisible of bools) {
        for (const hasInteraction of bools) {
          for (const isRefreshing of bools) {
            for (const lastAttemptAt of [null, T0 - 100_000, T0]) {
              for (const trigger of triggers) {
                assert.doesNotThrow(() => {
                  const r = shouldSync(
                    trigger,
                    { status, documentVisible, hasInteraction, isRefreshing, lastAttemptAt },
                    T0
                  )
                  assert.equal(typeof r, "boolean")
                })
              }
            }
          }
        }
      }
    }
  })
})
