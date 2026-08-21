/**
 * Testes das regras puras do funil de convite.
 *
 * Rodar: npm run test:invite
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import * as dominio from "./invite-visit.ts"
import {
  VISITOR_KEY_BYTES,
  VISITOR_KEY_MAX_LENGTH,
  INVITE_VISIT_RETENTION_DAYS,
  OPEN_SEMANTICS,
  UNIQUE_VISITS_LABEL,
  buildInviteLandingPath,
  buildShareMessage,
  conversionRate,
  countFunnel,
  generateVisitorKey,
  inviteVisitPurgeCutoff,
  isValidVisitorKey,
  resolveFunnelStage,
  shouldAttributeRequest,
  type InviteVisitTimestamps,
} from "./invite-visit.ts"
import {
  DEFAULT_ONBOARDING_DESTINATION,
  parseNextParam,
  resolveOnboardingDestination,
  withNext,
} from "./onboarding-next.ts"

const T0 = new Date("2026-08-21T12:00:00.000Z")

function visit(overrides: Partial<InviteVisitTimestamps> = {}): InviteVisitTimestamps {
  return {
    signedUpAt: null,
    petCreatedAt: null,
    requestCreatedAt: null,
    serviceCompletedAt: null,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// visitorKey — anônima, sem PII
// ─────────────────────────────────────────────────────────────────────────────

describe("visitorKey — pseudônima, aleatória, sem PII", () => {
  it("gera hex do tamanho esperado", () => {
    const key = generateVisitorKey()
    assert.equal(key.length, VISITOR_KEY_BYTES * 2)
    assert.match(key, /^[0-9a-f]+$/)
  })

  it("duas chaves consecutivas são diferentes (é aleatória, não derivada)", () => {
    // Se a chave viesse de fingerprint (IP, user-agent, device), duas
    // chamadas no mesmo processo produziriam o MESMO valor. Produzir valores
    // distintos é o que prova que não há derivação de característica alguma.
    const chaves = new Set(Array.from({ length: 50 }, () => generateVisitorKey()))
    assert.equal(chaves.size, 50)
  })

  it("cabe no teto da coluna", () => {
    assert.ok(generateVisitorKey().length <= VISITOR_KEY_MAX_LENGTH)
  })

  it("aceita apenas o formato que nós emitimos", () => {
    assert.equal(isValidVisitorKey(generateVisitorKey()), true)
  })

  it("REJEITA cookie adulterado — o cookie é entrada não confiável", () => {
    assert.equal(isValidVisitorKey(null), false)
    assert.equal(isValidVisitorKey(undefined), false)
    assert.equal(isValidVisitorKey(""), false)
    assert.equal(isValidVisitorKey("curta"), false)
    assert.equal(isValidVisitorKey("Z".repeat(32)), false, "não-hex")
    assert.equal(isValidVisitorKey("A".repeat(32)), false, "hex maiúsculo não é o nosso formato")
    assert.equal(isValidVisitorKey("a".repeat(64)), false, "comprimento errado")
  })

  it("REJEITA chave com PII colada dentro", () => {
    assert.equal(isValidVisitorKey("tutor@peteen.test"), false)
    assert.equal(isValidVisitorKey("192.168.0.1"), false)
    assert.equal(isValidVisitorKey(`${"a".repeat(32)}:tutor@peteen.test`), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Idempotência do OPEN
// ─────────────────────────────────────────────────────────────────────────────

describe("semântica do OPEN — visitante único, nunca page view", () => {
  it("o contrato declarado é 'visitante único'", () => {
    // Trava de contrato: se alguém mudar a semântica para contagem de
    // aberturas, precisa mudar este valor conscientemente — e aí revisar
    // todos os rótulos e taxas do backoffice.
    assert.equal(OPEN_SEMANTICS, "unique_visitor")
  })

  it("o rótulo do backoffice não é ambíguo", () => {
    // "Opens"/"Aberturas" leem como page view — exatamente o que a métrica
    // NÃO é. O denominador de toda taxa de conversão depende disso.
    assert.equal(UNIQUE_VISITS_LABEL, "Visitas únicas")
    assert.ok(!/abertura|opens?/i.test(UNIQUE_VISITS_LABEL))
  })

  it("NÃO existe API de atualizar openedAt — o carimbo é imutável", () => {
    // A idempotência real é do índice único + `createMany skipDuplicates`
    // no repositório. Não há função de domínio que decida "reabrir": sua
    // ausência é o contrato. Este teste falha se alguém reintroduzir uma.
    const exportado = dominio as Record<string, unknown>
    assert.equal(exportado.shouldRefreshOpenedAt, undefined)
    assert.equal(exportado.OPEN_DEDUP_WINDOW_MS, undefined)
  })
})

describe("retenção", () => {
  it("política é de 180 dias", () => {
    assert.equal(INVITE_VISIT_RETENTION_DAYS, 180)
  })

  it("corte do purge é exatamente 180 dias antes de agora", () => {
    const corte = inviteVisitPurgeCutoff(T0)
    const esperado = new Date(T0.getTime() - 180 * 24 * 60 * 60 * 1000)
    assert.equal(corte.toISOString(), esperado.toISOString())
  })

  it("registro recente NÃO entra no corte", () => {
    const corte = inviteVisitPurgeCutoff(T0)
    const ontem = new Date(T0.getTime() - 24 * 60 * 60 * 1000)
    assert.ok(ontem > corte, "visita de ontem precisa sobreviver ao purge")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Atribuição
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldAttributeRequest — a trava contra crédito indevido", () => {
  const visita = { professionalId: "pro-A", convertedUserId: "user-1" }

  it("atribui quando usuário E profissional batem", () => {
    assert.equal(
      shouldAttributeRequest(visita, { professionalId: "pro-A", tutorUserId: "user-1" }),
      true
    )
  })

  it("NÃO atribui request feita para OUTRO profissional", () => {
    // Caso central: tutor chegou pela landing de A e contratou B. Creditar A
    // transformaria a métrica em "quantos entraram e contrataram alguém".
    assert.equal(
      shouldAttributeRequest(visita, { professionalId: "pro-B", tutorUserId: "user-1" }),
      false
    )
  })

  it("NÃO atribui request de OUTRO tutor", () => {
    assert.equal(
      shouldAttributeRequest(visita, { professionalId: "pro-A", tutorUserId: "user-2" }),
      false
    )
  })

  it("NÃO atribui enquanto a visita não converteu", () => {
    assert.equal(
      shouldAttributeRequest(
        { professionalId: "pro-A", convertedUserId: null },
        { professionalId: "pro-A", tutorUserId: "user-1" }
      ),
      false
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Funil
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveFunnelStage", () => {
  it("visita sem nenhum marco está em 'opened'", () => {
    assert.equal(resolveFunnelStage(visit()), "opened")
  })

  it("cada marco avança o estágio", () => {
    assert.equal(resolveFunnelStage(visit({ signedUpAt: T0 })), "signed_up")
    assert.equal(resolveFunnelStage(visit({ signedUpAt: T0, petCreatedAt: T0 })), "pet_created")
    assert.equal(
      resolveFunnelStage(visit({ signedUpAt: T0, petCreatedAt: T0, requestCreatedAt: T0 })),
      "request_created"
    )
    assert.equal(
      resolveFunnelStage(
        visit({ signedUpAt: T0, petCreatedAt: T0, requestCreatedAt: T0, serviceCompletedAt: T0 })
      ),
      "service_completed"
    )
  })

  it("tutor que JÁ tinha pet pula petCreatedAt e ainda assim conta como request_created", () => {
    // Exigir a cadeia completa classificaria uma conversão de sucesso como se
    // tivesse parado no cadastro.
    assert.equal(
      resolveFunnelStage(visit({ signedUpAt: T0, petCreatedAt: null, requestCreatedAt: T0 })),
      "request_created"
    )
  })
})

describe("countFunnel — contagem cumulativa", () => {
  it("cada nível conta quem chegou nele OU além", () => {
    const visitas = [
      visit(),
      visit({ signedUpAt: T0 }),
      visit({ signedUpAt: T0, petCreatedAt: T0 }),
      visit({ signedUpAt: T0, petCreatedAt: T0, requestCreatedAt: T0, serviceCompletedAt: T0 }),
    ]
    assert.deepEqual(countFunnel(visitas), {
      opened: 4,
      signedUp: 3,
      petCreated: 2,
      requestCreated: 1,
      serviceCompleted: 1,
    })
  })

  it("lista vazia devolve tudo zero, sem lançar", () => {
    assert.deepEqual(countFunnel([]), {
      opened: 0,
      signedUp: 0,
      petCreated: 0,
      requestCreated: 0,
      serviceCompleted: 0,
    })
  })
})

describe("conversionRate", () => {
  it("calcula porcentagem com 1 casa", () => {
    assert.equal(conversionRate(20, 8), 40)
    assert.equal(conversionRate(3, 1), 33.3)
  })

  it("zero aberturas devolve 0 — nunca NaN nem Infinity numa tela", () => {
    assert.equal(conversionRate(0, 0), 0)
    assert.equal(conversionRate(0, 5), 0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Link e mensagem
// ─────────────────────────────────────────────────────────────────────────────

describe("link e mensagem de compartilhamento", () => {
  it("path canônico é /p/<id>", () => {
    assert.equal(buildInviteLandingPath("pro-123"), "/p/pro-123")
  })

  it("mensagem é curta, em primeira pessoa e contém o link", () => {
    const msg = buildShareMessage("João", "https://peteen.app/p/pro-123")
    assert.ok(msg.includes("https://peteen.app/p/pro-123"))
    assert.ok(msg.length < 200, "mensagem de WhatsApp precisa ser curta")
  })

  it("mensagem NÃO expõe id interno solto nem soa como anúncio corporativo", () => {
    const msg = buildShareMessage("João", "https://peteen.app/p/pro-123")
    assert.ok(!/\bprofessionalId\b/i.test(msg))
    assert.ok(!/promoção|desconto|imperdível/i.test(msg))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Preservação do contexto durante auth/onboarding
// ─────────────────────────────────────────────────────────────────────────────

describe("parseNextParam — só caminho interno seguro passa", () => {
  it("aceita caminho interno", () => {
    assert.equal(parseNextParam("/p/pro-123"), "/p/pro-123")
  })

  it("normaliza array (searchParams pode vir repetido)", () => {
    assert.equal(parseNextParam(["/p/pro-123", "/outro"]), "/p/pro-123")
  })

  it("REJEITA open redirect — absoluto, protocol-relative e esquema", () => {
    assert.equal(parseNextParam("https://evil.com"), null)
    assert.equal(parseNextParam("//evil.com"), null)
    assert.equal(parseNextParam("javascript:alert(1)"), null)
    assert.equal(parseNextParam("http://evil.com/p/x"), null)
  })

  it("REJEITA vazio e ausente", () => {
    assert.equal(parseNextParam(undefined), null)
    assert.equal(parseNextParam(""), null)
    assert.equal(parseNextParam("sem-barra"), null)
  })
})

describe("withNext — propaga o contexto pelas etapas do onboarding", () => {
  it("anexa next quando existe", () => {
    assert.equal(
      withNext("/onboarding/tutor/pet", "/p/pro-123"),
      "/onboarding/tutor/pet?next=%2Fp%2Fpro-123"
    )
  })

  it("preserva querystring já existente", () => {
    assert.equal(
      withNext("/onboarding/tutor?step=2", "/p/pro-1"),
      "/onboarding/tutor?step=2&next=%2Fp%2Fpro-1"
    )
  })

  it("sem contexto, o caminho fica intocado (nenhum parâmetro vazio à toa)", () => {
    assert.equal(withNext("/onboarding/tutor/pet", null), "/onboarding/tutor/pet")
  })
})

describe("resolveOnboardingDestination — fim do onboarding", () => {
  it("volta ao profissional que convidou quando há contexto", () => {
    assert.equal(resolveOnboardingDestination("/p/pro-123"), "/p/pro-123")
  })

  it("sem contexto, mantém o comportamento atual (Discovery)", () => {
    assert.equal(resolveOnboardingDestination(null), DEFAULT_ONBOARDING_DESTINATION)
    assert.equal(resolveOnboardingDestination(null), "/discover")
  })

  it("next hostil NUNCA vira destino — cai no padrão", () => {
    assert.equal(resolveOnboardingDestination("https://evil.com"), "/discover")
    assert.equal(resolveOnboardingDestination("//evil.com"), "/discover")
  })
})
