/**
 * Regressão do detector de P2002.
 *
 * Este teste existe por causa de um defeito real: a primeira versão comparava
 * com `Array.includes` (igualdade exata), o que fazia os formatos
 * `constraint.index` e `originalMessage` — que trazem o nome da coluna DENTRO
 * de um nome maior — nunca casarem. Os fallbacks existiam no comentário e não
 * no comportamento.
 *
 * Os três formatos são cobertos separadamente, para que a remoção de qualquer
 * um deles quebre um teste específico em vez de degradar em silêncio.
 *
 * Rodar: npm run test:care-media
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  uniqueViolationTarget,
  matchesUniqueConstraint,
} from "./prisma-unique-violation.ts"

/** Forma REAL capturada de @prisma/adapter-pg 7.8.0 contra o banco do projeto. */
function erroAdapterPg(constraintName: string, fields: string[]) {
  return {
    code: "P2002",
    meta: {
      modelName: "CareUpdate",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          originalCode: "23505",
          originalMessage: `duplicate key value violates unique constraint "${constraintName}"`,
          kind: "UniqueConstraintViolation",
          constraint: { fields: fields.map((f) => `"${f}"`) },
        },
      },
    },
  }
}

describe("uniqueViolationTarget — o que NÃO é P2002", () => {
  it("devolve null para erro comum, null, undefined e outros códigos", () => {
    assert.equal(uniqueViolationTarget(new Error("qualquer")), null)
    assert.equal(uniqueViolationTarget(null), null)
    assert.equal(uniqueViolationTarget(undefined), null)
    assert.equal(uniqueViolationTarget("P2002"), null)
    assert.equal(uniqueViolationTarget({ code: "P2003" }), null)
    assert.equal(uniqueViolationTarget({ code: "P2025", meta: {} }), null)
  })

  it("distingue 'não é P2002' (null) de 'é P2002 sem detalhe' (array)", () => {
    assert.equal(uniqueViolationTarget({ code: "P2003" }), null)
    assert.deepEqual(uniqueViolationTarget({ code: "P2002" }), [])
  })
})

describe("FORMATO 1 — meta.target (driver nativo)", () => {
  it("extrai array de colunas", () => {
    const nomes = uniqueViolationTarget({
      code: "P2002",
      meta: { target: ["requestId", "idempotencyKey"] },
    })
    assert.deepEqual(nomes, ["requestId", "idempotencyKey"])
    assert.equal(matchesUniqueConstraint(nomes!, "idempotencyKey"), true)
  })

  it("extrai target como string única", () => {
    const nomes = uniqueViolationTarget({ code: "P2002", meta: { target: "storagePath" } })
    assert.equal(matchesUniqueConstraint(nomes!, "storagePath"), true)
  })
})

describe("FORMATO 2 — constraint.fields (adapter-pg, caminho em uso hoje)", () => {
  it("extrai colunas removendo as aspas embutidas", () => {
    const nomes = uniqueViolationTarget(
      erroAdapterPg("care_updates_requestId_idempotencyKey_key", ["requestId", "idempotencyKey"])
    )
    assert.ok(nomes!.includes("requestId"), "aspas deveriam ter sido removidas")
    assert.ok(nomes!.includes("idempotencyKey"))
    assert.equal(matchesUniqueConstraint(nomes!, "idempotencyKey"), true)
  })

  it("identifica a constraint de storagePath", () => {
    const nomes = uniqueViolationTarget(erroAdapterPg("care_media_storagePath_key", ["storagePath"]))
    assert.equal(matchesUniqueConstraint(nomes!, "storagePath"), true)
    assert.equal(matchesUniqueConstraint(nomes!, "idempotencyKey"), false)
  })
})

describe("FORMATO 3 — constraint.index (sem fields)", () => {
  it("casa pelo NOME DO ÍNDICE, que contém a coluna dentro de um nome maior", () => {
    // Este é o caso que a versão anterior errava: includes() exato falharia.
    const erro = {
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: { constraint: { index: "care_updates_requestId_idempotencyKey_key" } },
        },
      },
    }
    const nomes = uniqueViolationTarget(erro)
    assert.deepEqual(nomes, ["care_updates_requestId_idempotencyKey_key"])
    assert.equal(
      nomes!.includes("idempotencyKey"),
      false,
      "igualdade exata NÃO casa — é exatamente o defeito que motivou este teste"
    )
    assert.equal(
      matchesUniqueConstraint(nomes!, "idempotencyKey"),
      true,
      "comparação por substring PRECISA casar"
    )
  })
})

describe("FORMATO 4 — originalMessage (último recurso)", () => {
  it("casa pela mensagem crua quando não há fields nem index", () => {
    const erro = {
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: {
            originalMessage:
              'duplicate key value violates unique constraint "care_media_storagePath_key"',
          },
        },
      },
    }
    const nomes = uniqueViolationTarget(erro)
    assert.equal(nomes!.length, 1)
    assert.equal(
      matchesUniqueConstraint(nomes!, "storagePath"),
      true,
      "fallback por mensagem PRECISA funcionar — era código morto antes"
    )
    assert.equal(matchesUniqueConstraint(nomes!, "idempotencyKey"), false)
  })
})

describe("sem falso positivo cruzado entre as duas constraints", () => {
  it("idempotencyKey e storagePath nunca se confundem, em nenhum formato", () => {
    const idem = [
      uniqueViolationTarget(
        erroAdapterPg("care_updates_requestId_idempotencyKey_key", ["requestId", "idempotencyKey"])
      )!,
      uniqueViolationTarget({
        code: "P2002",
        meta: { driverAdapterError: { cause: { constraint: { index: "care_updates_requestId_idempotencyKey_key" } } } },
      })!,
    ]
    const storage = [
      uniqueViolationTarget(erroAdapterPg("care_media_storagePath_key", ["storagePath"]))!,
      uniqueViolationTarget({
        code: "P2002",
        meta: { driverAdapterError: { cause: { constraint: { index: "care_media_storagePath_key" } } } },
      })!,
    ]

    for (const n of idem) {
      assert.equal(matchesUniqueConstraint(n, "idempotencyKey"), true)
      assert.equal(matchesUniqueConstraint(n, "storagePath"), false)
    }
    for (const n of storage) {
      assert.equal(matchesUniqueConstraint(n, "storagePath"), true)
      assert.equal(matchesUniqueConstraint(n, "idempotencyKey"), false)
    }
  })

  it("'requestId' isolado não é confundido com 'idempotencyKey'", () => {
    assert.equal(matchesUniqueConstraint(["requestId"], "idempotencyKey"), false)
  })
})
