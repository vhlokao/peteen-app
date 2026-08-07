/**
 * Testes focados — Service Uniqueness Concurrency Safety (parte pura).
 *
 * Runner: node:test nativo. Rodar:
 *   node --experimental-strip-types --test modules/professional/domain/service-uniqueness.test.ts
 *
 * Sem banco: `Prisma.PrismaClientKnownRequestError` é um tipo real do pacote
 * `@prisma/client`, construído aqui em memória — não requer conexão.
 *
 * O que fica FORA deste arquivo, por depender de banco real:
 *   - o próprio índice único parcial rejeitando a segunda escrita concorrente;
 *   - createServiceRecord/updateServiceRecord/reactivateServiceRecord convertendo
 *     o P2002 real do Postgres em DuplicateActiveServiceError;
 *   - os 7 cenários de concorrência da missão (criação, reativação, update de
 *     tipo, retry, inativos coexistindo, profissionais diferentes).
 *   Todos foram verificados ao vivo contra o banco de dev nesta missão — ver
 *   evidência na entrega. Não há suíte automatizada de integração com banco
 *   neste repo (convenção existente: só domínio puro roda em node:test).
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { Prisma } from "@prisma/client"

import {
  DuplicateActiveServiceError,
  isDuplicateActiveServiceViolation,
} from "./service-uniqueness.ts"

function fakeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7.8.0",
    meta: { target: ["professionalId", "serviceType"] },
  })
}

function fakePrismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`erro ${code}`, {
    code,
    clientVersion: "7.8.0",
  })
}

describe("isDuplicateActiveServiceViolation", () => {
  it("reconhece P2002 vindo do Prisma", () => {
    assert.equal(isDuplicateActiveServiceViolation(fakeP2002()), true)
  })

  it("não mascara outros PrismaClientKnownRequestError (ex.: P2025 - not found)", () => {
    assert.equal(isDuplicateActiveServiceViolation(fakePrismaError("P2025")), false)
  })

  it("não mascara P2003 (violação de FK, erro real e diferente)", () => {
    assert.equal(isDuplicateActiveServiceViolation(fakePrismaError("P2003")), false)
  })

  it("não reconhece erro genérico (não é PrismaClientKnownRequestError)", () => {
    assert.equal(isDuplicateActiveServiceViolation(new Error("qualquer erro")), false)
  })

  it("não reconhece string, null, undefined ou objeto solto", () => {
    assert.equal(isDuplicateActiveServiceViolation("P2002"), false)
    assert.equal(isDuplicateActiveServiceViolation(null), false)
    assert.equal(isDuplicateActiveServiceViolation(undefined), false)
    assert.equal(isDuplicateActiveServiceViolation({ code: "P2002" }), false)
  })
})

describe("DuplicateActiveServiceError", () => {
  it("é uma instância de Error com nome próprio", () => {
    const err = new DuplicateActiveServiceError("create, professionalId=x, serviceType=DOG_WALK")
    assert.ok(err instanceof Error)
    assert.equal(err.name, "DuplicateActiveServiceError")
  })

  it("a mensagem carrega o contexto técnico mas nunca é exposta ao usuário final", () => {
    // Contrato: a camada application SEMPRE substitui esta mensagem pela
    // mensagem neutra ("Você já possui um serviço ativo deste tipo.") — este
    // teste apenas garante que o contexto passado chega até a mensagem, para
    // fins de log/observabilidade interna.
    const err = new DuplicateActiveServiceError("reactivate, id=abc123")
    assert.match(err.message, /reactivate, id=abc123/)
  })

  it("distinguível de outros erros via instanceof", () => {
    const err = new DuplicateActiveServiceError("update, id=x, serviceType=GROOMING")
    assert.ok(err instanceof DuplicateActiveServiceError)
    assert.ok(!(new Error("outro") instanceof DuplicateActiveServiceError))
  })
})
