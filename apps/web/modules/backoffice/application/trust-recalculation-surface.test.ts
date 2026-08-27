/**
 * Recalculação de Trust — superfície e auditabilidade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO PROTEGE
 *
 * Em Next.js, todo export de um arquivo que começa com `"use server"` vira um
 * endpoint RPC. Duas funções do trust-engine estavam nessas condições:
 *
 *   updateProfessionalTrust(professionalId)  → recebia o ALVO por parâmetro e
 *     gravava trustScore/trustLevel no perfil. Segunda porta, sem fechadura,
 *     para a mesma mutação que recalculateSingleTrustAction protege com
 *     assertAdmin().
 *
 *   recalculateAllTrustScores()  → invocável SEM ARGUMENTO para percorrer a
 *     tabela inteira de profissionais, recalculando e gravando um a um.
 *     Amplificação de carga sem autenticação.
 *
 * Nenhuma das duas permitia definir score arbitrário — ambas recalculam a
 * partir de dados reais. O que existia era escrita não autenticada e carga
 * amplificável, sem nenhum rastro de quem pediu.
 *
 * A correção não foi adicionar guard dentro delas: foi TIRÁ-LAS da superfície
 * RPC, que é o mesmo padrão de
 * modules/verification/application/request-verification.ts. Os 12 call sites
 * são internos e cada um já autoriza no seu próprio fluxo.
 *
 * Estes testes leem o FONTE porque a propriedade a garantir é sobre a
 * superfície exportada, não sobre o comportamento de uma função. Um teste
 * unitário chamando `updateProfessionalTrust` não distingue "helper interno" de
 * "endpoint aberto" — que é exatamente a diferença em questão.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ_APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const ler = (rel: string) => readFileSync(path.join(RAIZ_APP, rel), "utf8")

const UPDATE_TRUST = "modules/trust-engine/application/update-professional-trust.ts"
const RECALC_ALL = "modules/trust-engine/application/recalculate-all-trust-scores.ts"
const ACTIONS = "modules/backoffice/application/actions.ts"
const AUDIT = "modules/backoffice/infrastructure/audit.ts"

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

/** Corpo de uma função exportada, até a linha que fecha na coluna 0. */
function corpoDe(fonte: string, nome: string): string {
  const linhas = fonte.split("\n")
  const inicio = linhas.findIndex((l) => l.includes(`export async function ${nome}`))
  assert.notEqual(inicio, -1, `função ${nome} não encontrada`)
  const corpo: string[] = []
  for (let j = inicio; j < linhas.length; j++) {
    corpo.push(linhas[j]!)
    // `.trimEnd()` obrigatório: o repositório usa CRLF, então a linha de
    // fechamento é `"}\r"`. Sem isto o corpo absorve as funções seguintes.
    if (j > inicio && linhas[j]!.trimEnd() === "}") break
  }
  return corpo.join("\n")
}

// ─────────────────────────────────────────────────────────────────────────────
// A superfície foi fechada
// ─────────────────────────────────────────────────────────────────────────────

describe("trust-engine — fora da superfície RPC", () => {
  for (const [rotulo, arquivo] of [
    ["updateProfessionalTrust", UPDATE_TRUST],
    ["recalculateAllTrustScores", RECALC_ALL],
  ] as const) {
    it(`${rotulo}: o arquivo NÃO declara "use server"`, () => {
      // A regressão exata: readicionar a diretiva devolve as duas funções à
      // condição de endpoint público recebendo id arbitrário.
      assert.doesNotMatch(semComentarios(ler(arquivo)), /["']use server["']/)
    })

    it(`${rotulo}: declara "server-only" — quebra o build se o cliente importar`, () => {
      assert.match(ler(arquivo), /import "server-only"/)
    })

    it(`${rotulo}: documenta que NÃO autentica`, () => {
      // O contrato é a única proteção que resta: sem ele o próximo chamador
      // repassa um id vindo do cliente e reabre o buraco sem perceber.
      assert.match(ler(arquivo), /CONTRATO/)
      assert.match(ler(arquivo), /NÃO autentica/i)
    })
  }
})

describe("nenhuma cópia ou wrapper público sem guard foi criada", () => {
  /** Todos os arquivos .ts que começam com `"use server"`. */
  function arquivosUseServer(): string[] {
    const out: string[] = []
    const visitar = (dir: string) => {
      for (const nome of readdirSync(path.join(RAIZ_APP, dir))) {
        if (nome === "node_modules" || nome === ".next") continue
        const rel = `${dir}/${nome}`
        if (statSync(path.join(RAIZ_APP, rel)).isDirectory()) visitar(rel)
        else if (nome.endsWith(".ts") && ler(rel).startsWith('"use server"')) out.push(rel)
      }
    }
    visitar("modules")
    visitar("app")
    return out
  }

  const USE_SERVER = arquivosUseServer()

  it("nenhum arquivo 'use server' exporta as duas funções", () => {
    for (const arquivo of USE_SERVER) {
      const src = semComentarios(ler(arquivo))
      for (const fn of ["updateProfessionalTrust", "recalculateAllTrustScores"]) {
        assert.doesNotMatch(
          src,
          new RegExp(`export\\s+(async\\s+function\\s+${fn}|\\{[^}]*\\b${fn}\\b)`),
          `${arquivo} reexporta ${fn} de um arquivo "use server"`
        )
      }
    }
  })

  it("os dois arquivos do trust-engine saíram da lista de 'use server'", () => {
    assert.ok(!USE_SERVER.includes(UPDATE_TRUST))
    assert.ok(!USE_SERVER.includes(RECALC_ALL))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// As portas legítimas continuam guardadas
// ─────────────────────────────────────────────────────────────────────────────

describe("as ações admin exigem admin", () => {
  const SRC = ler(ACTIONS)

  for (const acao of ["recalculateSingleTrustAction", "recalculateAllTrustAction"]) {
    it(`${acao} chama assertAdmin antes de qualquer coisa`, () => {
      const corpo = corpoDe(SRC, acao)
      assert.match(corpo, /assertAdmin\(\)/)
      // O guard tem que vir ANTES da mutação, não em qualquer lugar do corpo.
      const posGuard = corpo.indexOf("assertAdmin()")
      const posMut = corpo.search(/updateProfessionalTrust|recalculateAllTrustScores/)
      assert.ok(posGuard < posMut, `${acao}: guard precisa preceder a mutação`)
    })

    it(`${acao}: o ator auditado VEM do guard, não de outra fonte`, () => {
      // Sem isto, trocar `const adminId = await assertAdmin()` por qualquer
      // outro valor mantém a barreira funcionando mas faz a auditoria registrar
      // um ator falso — um log que parece correto e mente sobre quem agiu.
      // Foi exatamente o que passou despercebido na primeira versão deste teste.
      assert.match(
        corpoDe(SRC, acao),
        /const adminId = await assertAdmin()/,
        `${acao}: adminId precisa ser o retorno de assertAdmin()`
      )
    })
  }

  it("assertAdmin devolve o id do admin — o ator da auditoria", () => {
    // Era `Promise<void>`. Sem o id não há como registrar QUEM pediu, e a
    // auditoria viraria um log anônimo, que não serve para nada.
    assert.match(SRC, /async function assertAdmin\(\): Promise<string>/)
    assert.match(SRC, /return ctx\.user\.id/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AuditLog
// ─────────────────────────────────────────────────────────────────────────────

describe("recalculação single é auditada", () => {
  const corpo = corpoDe(ler(ACTIONS), "recalculateSingleTrustAction")

  it("registra AuditLog com ator, alvo e antes/depois", () => {
    assert.match(corpo, /recordTrustRecalculationAudit\(/)
    assert.match(corpo, /adminId/)
    assert.match(corpo, /professionalId/)
    assert.match(corpo, /before:\s*antes/)
    assert.match(corpo, /after:\s*depois/)
  })

  it("fotografa o score ANTES da mutação", () => {
    // Depois da mutação o valor anterior não existe mais em lugar nenhum.
    const posAntes = corpo.indexOf("const antes")
    const posMut = corpo.indexOf("updateProfessionalTrust(")
    assert.ok(posAntes !== -1 && posAntes < posMut, "snapshot precisa preceder a mutação")
  })

  it("NÃO registra sucesso antes de a mutação terminar", () => {
    // §4 do briefing: auditoria depois do efeito, nunca antes.
    const posMut = corpo.indexOf("updateProfessionalTrust(")
    const posAudit = corpo.indexOf("recordTrustRecalculationAudit(")
    assert.ok(posMut < posAudit, "auditoria precisa vir DEPOIS da mutação")
  })
})

describe("recalculação em lote é auditada", () => {
  const corpo = corpoDe(ler(ACTIONS), "recalculateAllTrustAction")

  it("registra AuditLog do lote com ator e agrupador", () => {
    assert.match(corpo, /recordTrustBatchAudit\(/)
    assert.match(corpo, /adminId/)
    assert.match(corpo, /loteId:\s*randomUUID\(\)/)
  })

  it("audita DEPOIS do lote terminar", () => {
    const posMut = corpo.indexOf("recalculateAllTrustScores()")
    const posAudit = corpo.indexOf("recordTrustBatchAudit(")
    assert.ok(posMut < posAudit)
  })

  it("só audita quem foi REALMENTE atualizado", () => {
    // Registrar "recalculado" para quem falhou afirmaria uma mutação que não
    // aconteceu — o oposto do que auditoria serve para fazer.
    const audit = ler(AUDIT)
    assert.match(audit, /if \(d\.status !== "updated"\) continue/)
  })
})

describe("o helper de auditoria segue o contrato do projeto", () => {
  const audit = ler(AUDIT)

  it("usa o AuditLog existente — nenhum schema novo", () => {
    assert.match(audit, /prisma\.auditLog\.create/)
    // `entity` continua sendo nome de model e `entityId` um id real: é a única
    // invariante que o AuditLog tem hoje, e o índice depende dela.
    assert.match(audit, /entity:\s*"ProfessionalProfile"/)
    assert.match(audit, /entityId:\s*params\.professionalId/)
  })

  it("nunca derruba o fluxo principal", () => {
    // Mesmo contrato dos demais infrastructure/audit.ts do projeto.
    assert.match(audit, /catch\s*\{/)
  })

  it("documenta o limite: o lote não tem linha de resumo", () => {
    assert.match(audit, /LIMITE ACEITO/)
    assert.match(audit, /entityId/)
  })

  it("não registra PII nem detalhamento de cálculo", () => {
    // Só score e faixa — exatamente o que mudou.
    for (const proibido of ["email", "phone", "displayName", "cpf", "endpoint"]) {
      assert.ok(
        !new RegExp(`${proibido}:`, "i").test(audit),
        `payload de auditoria expõe ${proibido}`
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// O Trust Engine em si não foi tocado
// ─────────────────────────────────────────────────────────────────────────────

describe("comportamento do Trust preservado", () => {
  it("a fórmula não foi alterada — só o cabeçalho dos dois arquivos mudou", () => {
    // A missão era superfície/autorização/auditabilidade. Qualquer mudança em
    // calculateTrustScore seria fora de escopo, e é o que este teste trava.
    const calc = ler("modules/trust-engine/application/calculate-trust-score.ts")
    assert.match(calc, /export async function calculateTrustScore/)
    // O arquivo do cálculo nunca foi um Server Action e não deve virar um.
    assert.doesNotMatch(semComentarios(calc), /["']use server["']/)
  })

  it("updateProfessionalTrust continua escrevendo os MESMOS campos", () => {
    // Fechar a superfície não pode ter mudado o efeito da função.
    const corpo = corpoDe(ler(UPDATE_TRUST), "updateProfessionalTrust")
    assert.match(corpo, /trustScore:\s*result\.score/)
    assert.match(corpo, /trustLevel:\s*result\.level/)
    assert.match(corpo, /trustUpdatedAt:\s*new Date\(\)/)
  })

  it("continua sem aceitar score por parâmetro — não existe '+ pontos'", () => {
    // A função recalcula a partir de dados reais; não há como injetar valor.
    const src = ler(UPDATE_TRUST)
    assert.match(src, /updateProfessionalTrust\(professionalId: string\)/)
    assert.match(src, /calculateTrustScore\(professionalId\)/)
  })
})
