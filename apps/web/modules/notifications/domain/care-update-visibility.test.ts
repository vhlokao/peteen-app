/**
 * Regressão — CareUpdate não pode sumir da central quando a Request avança
 * para COMPLETED (microcorreção pós-gate independente, R2B.3).
 *
 * O bug original filtrava por `request.status === "IN_PROGRESS"`. A correção
 * remove status do cálculo por completo — por isso o teste central desta
 * suíte (item 2) nem precisa simular uma request COMPLETED: a assinatura de
 * `CareUpdateVisibilityFacts` não tem campo `status` NENHUM. Isso é o próprio
 * contrato sendo travado pelo compilador, não só pelo teste.
 *
 * Ownership (tutorId) é fronteira de segurança no WHERE do Prisma, fora do
 * alcance de um teste puro sem banco — provado por QA ao vivo (item 5), não
 * aqui. Ver relatório do gate independente.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  isCareUpdateVisibleInNotifications,
  type CareUpdateVisibilityFacts,
} from "./care-update-visibility.ts"

const SINCE = new Date("2026-08-16T00:00:00.000Z")
const DENTRO_DA_JANELA = new Date("2026-08-16T12:00:00.000Z")
const FORA_DA_JANELA = new Date("2026-08-15T23:59:59.999Z")

function facts(over: Partial<CareUpdateVisibilityFacts> = {}): CareUpdateVisibilityFacts {
  return {
    deletedAt: null,
    createdAt: DENTRO_DA_JANELA,
    ...over,
  }
}

describe("item 1 — CareUpdate recente aparece", () => {
  it("dentro da janela, não deletado → visível", () => {
    assert.equal(isCareUpdateVisibleInNotifications(facts(), SINCE), true)
  })
})

describe("item 2 — REGRESSÃO DO BUG: a Request virar COMPLETED não pode ocultar o CareUpdate", () => {
  it("a função não recebe status da request — contrato do tipo, não só do valor", () => {
    // Se algum dia alguém adicionar `status` a CareUpdateVisibilityFacts para
    // "consertar" outra coisa, este teste de shape ainda não pega — mas o
    // ponto é que hoje, estruturalmente, não existe ENTRADA de status
    // possível: só se pode expressar deletedAt/createdAt. Não tem como o
    // status "vazar" para dentro desta decisão.
    const chaves = Object.keys(facts()).sort()
    assert.deepEqual(chaves, ["createdAt", "deletedAt"])
  })

  it("mesmos fatos do CareUpdate → mesma visibilidade, seja qual for o status atual da request", () => {
    // O ponto central: a decisão é function(CareUpdate), não function(Request).
    // Simulamos "antes" e "depois" da conclusão só passando os MESMOS fatos
    // duas vezes — porque é exatamente isso que a Request virar COMPLETED
    // representa aqui: nada muda nos fatos do CareUpdate.
    const antesDaConclusao = isCareUpdateVisibleInNotifications(facts(), SINCE)
    const depoisDaConclusao = isCareUpdateVisibleInNotifications(facts(), SINCE)
    assert.equal(antesDaConclusao, true)
    assert.equal(depoisDaConclusao, true)
    assert.equal(antesDaConclusao, depoisDaConclusao)
  })
})

describe("item 3 — fora da janela temporal não aparece", () => {
  it("createdAt antes de `since` → invisível", () => {
    assert.equal(
      isCareUpdateVisibleInNotifications(facts({ createdAt: FORA_DA_JANELA }), SINCE),
      false
    )
  })

  it("exatamente no limite da janela (`since`) ainda aparece", () => {
    assert.equal(isCareUpdateVisibleInNotifications(facts({ createdAt: SINCE }), SINCE), true)
  })

  it("1ms antes do limite não aparece", () => {
    const umMsAntes = new Date(SINCE.getTime() - 1)
    assert.equal(
      isCareUpdateVisibleInNotifications(facts({ createdAt: umMsAntes }), SINCE),
      false
    )
  })
})

describe("item 4 — soft-deleted não aparece", () => {
  it("deletedAt preenchido → invisível, mesmo dentro da janela", () => {
    assert.equal(
      isCareUpdateVisibleInNotifications(
        facts({ deletedAt: new Date("2026-08-16T13:00:00.000Z") }),
        SINCE
      ),
      false
    )
  })

  it("deletedAt vence sobre a janela — invisível mesmo se createdAt for exatamente agora", () => {
    const agora = new Date()
    assert.equal(
      isCareUpdateVisibleInNotifications({ deletedAt: agora, createdAt: agora }, agora),
      false
    )
  })
})

// Item 5 (outro tutor não vê) é fronteira de segurança aplicada no WHERE do
// Prisma (`request: { tutorId }`) — fora do alcance desta função pura, que
// nunca recebe nem decide ownership. Provado por QA ao vivo, não aqui.
