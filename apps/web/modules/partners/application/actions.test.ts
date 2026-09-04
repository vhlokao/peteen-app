/**
 * Fiação de `createPartnerAction`/`updatePartnerAction` — validação de
 * telefone roda ANTES do repository (GATE-8-PARTNER-INPUT-MASKS-FIX-003).
 *
 * Runner: node:test nativo.
 * Rodar: node --experimental-strip-types --test modules/partners/application/actions.test.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE TESTE DE FONTE, E NÃO IMPORT DIRETO
 *
 * `actions.ts` começa com `"use server"` — todo export vira endpoint RPC, e
 * chamar as funções fora do runtime do Next (sem sessão, sem Prisma real)
 * não é viável num teste puro. O mesmo padrão já usado em
 * `modules/identity/infrastructure/auth-callback-url.test.ts` para arquivos
 * `"use server"`: ler o fonte e verificar o CONTRATO — aqui, que a checagem
 * de telefone precede a chamada ao repository em cada action, para que uma
 * entrada inválida nunca chegue a ser persistida.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(AQUI, "actions.ts"), "utf8")

function corpoDe(nome: string): string {
  const linhas = SRC.split("\n")
  const inicio = linhas.findIndex((l) => l.includes(`export async function ${nome}`))
  assert.notEqual(inicio, -1, `${nome} não encontrada`)
  const corpo: string[] = []
  let chaves = 0
  let comecou = false
  for (let j = inicio; j < linhas.length; j++) {
    corpo.push(linhas[j]!)
    for (const ch of linhas[j]!) {
      if (ch === "{") { chaves++; comecou = true }
      if (ch === "}") chaves--
    }
    if (comecou && chaves === 0) break
  }
  return corpo.join("\n")
}

describe("validatePartnerPhoneOrError usa a regra compartilhada, não uma reimplementação", () => {
  it("chama isValidOptionalPartnerPhone — importado do módulo de domínio", () => {
    assert.match(SRC, /import\s*\{\s*isValidOptionalPartnerPhone\s*\}\s*from\s*"..\/domain\/phone-format"/)
    assert.match(SRC, /isValidOptionalPartnerPhone\(phone\)/)
  })
})

describe("createPartnerAction valida telefone antes de persistir", () => {
  const corpo = corpoDe("createPartnerAction")

  it("chama validatePartnerPhoneOrError", () => {
    assert.match(corpo, /validatePartnerPhoneOrError\(input\.phone\)/)
  })

  it("a validação de telefone vem ANTES da chamada a createPartner — nunca persiste antes de validar", () => {
    const posValidacao = corpo.indexOf("validatePartnerPhoneOrError(")
    const posCreate = corpo.indexOf("await createPartner(")
    assert.ok(posValidacao !== -1 && posCreate !== -1, "chamadas não encontradas")
    assert.ok(posValidacao < posCreate, "validação deveria vir antes de createPartner")
  })

  it("telefone inválido retorna erro em vez de seguir para o repository", () => {
    assert.match(corpo, /if\s*\(phoneError\)\s*return\s*\{\s*ok:\s*false,\s*error:\s*phoneError\s*\}/)
  })
})

describe("updatePartnerAction valida telefone antes de persistir", () => {
  const corpo = corpoDe("updatePartnerAction")

  it("chama validatePartnerPhoneOrError", () => {
    assert.match(corpo, /validatePartnerPhoneOrError\(input\.phone\)/)
  })

  it("a validação de telefone vem ANTES da chamada a updatePartner — nunca persiste antes de validar", () => {
    const posValidacao = corpo.indexOf("validatePartnerPhoneOrError(")
    const posUpdate = corpo.indexOf("await updatePartner(")
    assert.ok(posValidacao !== -1 && posUpdate !== -1, "chamadas não encontradas")
    assert.ok(posValidacao < posUpdate, "validação deveria vir antes de updatePartner")
  })

  it("telefone inválido retorna erro em vez de seguir para o repository", () => {
    assert.match(corpo, /if\s*\(phoneError\)\s*return\s*\{\s*ok:\s*false,\s*error:\s*phoneError\s*\}/)
  })
})

describe("a validação roda DEPOIS de requireAdmin em ambas as actions", () => {
  it("createPartnerAction: requireAdmin antes da checagem de telefone", () => {
    const corpo = corpoDe("createPartnerAction")
    const posAdmin = corpo.indexOf("requireAdmin()")
    const posValidacao = corpo.indexOf("validatePartnerPhoneOrError(")
    assert.ok(posAdmin !== -1 && posValidacao !== -1)
    assert.ok(posAdmin < posValidacao, "auth deveria vir antes da validação de telefone")
  })

  it("updatePartnerAction: requireAdmin antes da checagem de telefone", () => {
    const corpo = corpoDe("updatePartnerAction")
    const posAdmin = corpo.indexOf("requireAdmin()")
    const posValidacao = corpo.indexOf("validatePartnerPhoneOrError(")
    assert.ok(posAdmin !== -1 && posValidacao !== -1)
    assert.ok(posAdmin < posValidacao, "auth deveria vir antes da validação de telefone")
  })
})
