/**
 * Backoffice — timeline operacional de uma solicitação.
 *
 * Rodar: npm run test:backoffice
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  contarAtencao,
  montarTimelineOperacional,
  type TimelineInput,
} from "./request-timeline.ts"

const T = (iso: string) => new Date(iso)

const BASE: TimelineInput = {
  request: {
    createdAt: T("2026-08-20T10:00:00Z"),
    startedAt: null,
    completedAt: null,
    status: "PENDING",
    updatedAt: T("2026-08-20T10:00:00Z"),
  },
  careUpdates: [],
  pushes: [],
  auditLogs: [],
  disputes: [],
}

const montar = (p: Partial<TimelineInput>) =>
  montarTimelineOperacional({ ...BASE, ...p })

describe("ordem", () => {
  it("ordena por instante", () => {
    const eventos = montar({
      request: {
        ...BASE.request,
        startedAt: T("2026-08-20T12:00:00Z"),
        completedAt: T("2026-08-20T14:00:00Z"),
        status: "COMPLETED",
        updatedAt: T("2026-08-20T14:00:00Z"),
      },
    })
    const horas = eventos.map((e) => e.at.toISOString())
    assert.deepEqual(horas, [...horas].sort())
  })

  it("no MESMO instante, o fato de domínio vem antes do push que ele gerou", () => {
    // Acontece de verdade: a Request é criada e o push despachado na mesma
    // Server Action, ambos no mesmo segundo. Sem desempate estável, a leitura
    // sugeriria que o aviso saiu antes do fato — a conclusão errada numa
    // investigação.
    const eventos = montar({
      pushes: [
        {
          createdAt: T("2026-08-20T10:00:00Z"),
          eventType: "request_created",
          recipientLabel: "pro@x.test",
          outcomeLabel: "Aceito pelo provedor",
          atencao: false,
        },
      ],
    })
    assert.equal(eventos[0]!.fonte, "ServiceRequest")
    assert.equal(eventos[1]!.fonte, "PushDelivery")
  })
})

describe("estados terminais", () => {
  it("EXPIRED aparece com rótulo próprio e pede atenção", () => {
    const eventos = montar({
      request: { ...BASE.request, status: "EXPIRED", updatedAt: T("2026-08-20T11:00:00Z") },
    })
    const terminal = eventos.find((e) => e.titulo === "Expirou sem resposta")
    assert.ok(terminal, "EXPIRED sumiu da timeline")
    assert.equal(terminal!.atencao, true)
  })

  it("cancelamento distingue quem cancelou", () => {
    const tutor = montar({
      request: { ...BASE.request, status: "CANCELLED_BY_TUTOR", updatedAt: T("2026-08-20T11:00:00Z") },
    })
    const pro = montar({
      request: {
        ...BASE.request,
        status: "CANCELLED_BY_PROFESSIONAL",
        updatedAt: T("2026-08-20T11:00:00Z"),
      },
    })
    assert.ok(tutor.some((e) => e.titulo === "Cancelado pelo tutor"))
    assert.ok(pro.some((e) => e.titulo === "Cancelado pelo profissional"))
  })

  it("terminal sem carimbo próprio avisa que o instante é aproximado", () => {
    // `updatedAt` é o melhor disponível para cancelamento/expiração. Dizer
    // isso evita que alguém trate o horário como exato numa disputa.
    const eventos = montar({
      request: { ...BASE.request, status: "EXPIRED", updatedAt: T("2026-08-20T11:00:00Z") },
    })
    const terminal = eventos.find((e) => e.titulo === "Expirou sem resposta")!
    assert.match(terminal.detalhe ?? "", /aproximado/i)
  })

  it("COMPLETED não duplica: usa completedAt, nunca updatedAt", () => {
    // `updatedAt` se move depois (uma avaliação posterior, por exemplo), o que
    // criaria uma segunda linha de conclusão em horário errado.
    const eventos = montar({
      request: {
        ...BASE.request,
        completedAt: T("2026-08-20T14:00:00Z"),
        status: "COMPLETED",
        updatedAt: T("2026-08-21T09:00:00Z"),
      },
    })
    const conclusoes = eventos.filter((e) => e.titulo === "Atendimento concluído")
    assert.equal(conclusoes.length, 1)
    assert.equal(conclusoes[0]!.at.toISOString(), "2026-08-20T14:00:00.000Z")
  })
})

describe("Care Timeline entra como MARCADOR, nunca como conteúdo", () => {
  const comUpdate = (extra: Partial<TimelineInput["careUpdates"][number]> = {}) =>
    montar({
      careUpdates: [
        {
          createdAt: T("2026-08-20T12:00:00Z"),
          occurredAt: T("2026-08-20T12:00:00Z"),
          category: "ALIMENTACAO",
          authorName: "João",
          editedAt: null,
          deletedAt: null,
          mediaCount: 0,
          ...extra,
        },
      ],
    })

  it("o tipo de entrada não tem campo de conteúdo", () => {
    // Trava estrutural: se alguém acrescentar `content` ao input, este teste
    // continua passando, mas o de fonte em push-observability.test.ts pega a
    // leitura no repositório. Aqui garantimos que o DETALHE montado não
    // carrega texto livre do Diário.
    const eventos = comUpdate()
    const marcador = eventos.find((e) => e.fonte === "CareUpdate")!
    assert.equal(marcador.titulo, "Atualização do Diário")
    assert.match(marcador.detalhe!, /ALIMENTACAO/)
    assert.match(marcador.detalhe!, /João/)
  })

  it("mídia aparece como contagem", () => {
    const eventos = comUpdate({ mediaCount: 3 })
    assert.match(eventos.find((e) => e.fonte === "CareUpdate")!.detalhe!, /3 mídia/)
  })

  it("excluída e editada são visíveis para investigação", () => {
    const excluida = comUpdate({ deletedAt: T("2026-08-20T13:00:00Z") })
    assert.match(excluida.find((e) => e.fonte === "CareUpdate")!.titulo, /excluída/)

    const editada = comUpdate({ editedAt: T("2026-08-20T13:00:00Z") })
    assert.match(editada.find((e) => e.fonte === "CareUpdate")!.detalhe!, /editada/)
  })

  it("occurredAt divergente é sinalizado", () => {
    const eventos = comUpdate({ occurredAt: T("2026-08-20T09:30:00Z") })
    assert.match(eventos.find((e) => e.fonte === "CareUpdate")!.detalhe!, /ocorrido em/)
  })

  it("occurredAt igual a createdAt não polui o detalhe", () => {
    assert.ok(!comUpdate().find((e) => e.fonte === "CareUpdate")!.detalhe!.includes("ocorrido em"))
  })
})

describe("atenção", () => {
  it("disputa aberta sempre pede atenção", () => {
    const eventos = montar({
      disputes: [
        {
          createdAt: T("2026-08-20T15:00:00Z"),
          resolvedAt: null,
          reason: "SERVICO_NAO_REALIZADO",
          status: "OPEN",
        },
      ],
    })
    const abertura = eventos.find((e) => e.titulo === "Disputa aberta")!
    assert.equal(abertura.atencao, true)
  })

  it("disputa encerrada acrescenta um segundo ponto, sem atenção", () => {
    const eventos = montar({
      disputes: [
        {
          createdAt: T("2026-08-20T15:00:00Z"),
          resolvedAt: T("2026-08-21T10:00:00Z"),
          reason: "X",
          status: "RESOLVED",
        },
      ],
    })
    const encerramento = eventos.find((e) => e.titulo.startsWith("Disputa encerrada"))!
    assert.equal(encerramento.atencao, false)
    assert.equal(contarAtencao(eventos), 1)
  })

  it("push com falha acionável propaga a atenção", () => {
    const eventos = montar({
      pushes: [
        {
          createdAt: T("2026-08-20T10:00:01Z"),
          eventType: "request_created",
          recipientLabel: "pro@x.test",
          outcomeLabel: "Falha de configuração",
          atencao: true,
        },
      ],
    })
    assert.equal(contarAtencao(eventos), 1)
  })

  it("atendimento saudável não gera nenhum ponto de atenção", () => {
    const eventos = montar({
      request: {
        ...BASE.request,
        startedAt: T("2026-08-20T12:00:00Z"),
        completedAt: T("2026-08-20T14:00:00Z"),
        status: "COMPLETED",
        updatedAt: T("2026-08-20T14:00:00Z"),
      },
      pushes: [
        {
          createdAt: T("2026-08-20T12:00:01Z"),
          eventType: "service_started",
          recipientLabel: "tutor@x.test",
          outcomeLabel: "Aceito pelo provedor",
          atencao: false,
        },
      ],
    })
    assert.equal(contarAtencao(eventos), 0)
  })
})

describe("vazio", () => {
  it("uma request recém-criada tem exatamente um evento", () => {
    const eventos = montar({})
    assert.equal(eventos.length, 1)
    assert.equal(eventos[0]!.titulo, "Solicitação criada")
  })
})
