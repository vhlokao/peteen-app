import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { isDisputeFormDirty } from "./dispute-form-state.ts"
import { DISPUTE_REASON_OPTIONS } from "./types.ts"

const DEFAULT = DISPUTE_REASON_OPTIONS[0]
const OTHER = DISPUTE_REASON_OPTIONS[1]

describe("isDisputeFormDirty", () => {
  test("item A — form aberto, motivo padrão, descrição vazia — não é sujo", () => {
    assert.equal(isDisputeFormDirty(DEFAULT, DEFAULT, ""), false)
  })

  test("descrição só com espaços não conta como digitada", () => {
    assert.equal(isDisputeFormDirty(DEFAULT, DEFAULT, "   "), false)
  })

  test("item B — motivo mudou — é sujo", () => {
    assert.equal(isDisputeFormDirty(OTHER, DEFAULT, ""), true)
  })

  test("item B — descrição preenchida — é sujo", () => {
    assert.equal(isDisputeFormDirty(DEFAULT, DEFAULT, "Chegou atrasado"), true)
  })

  test("item C — motivo e descrição voltam ao estado inicial — não é mais sujo", () => {
    assert.equal(isDisputeFormDirty(DEFAULT, DEFAULT, ""), false)
  })
})
