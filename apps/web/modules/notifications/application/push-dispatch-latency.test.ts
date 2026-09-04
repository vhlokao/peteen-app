/**
 * Push best-effort não pode voltar a bloquear a resposta da Server Action
 * (GATE-3-REQUEST-LATENCY-001).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ISTO TRAVA
 *
 * `dispatchPush` pode levar até ~6s no pior caso sob rede instável (3
 * tentativas de até 3s cada por device — ver PUSH_RETRY_DEADLINE_MS/
 * PUSH_MAX_RETRY_ATTEMPTS em push-failure.ts). `Promise.allSettled` sobre N
 * devices não multiplica isso, mas antes desta missão a chamada era `await`ada
 * dentro da própria Server Action que já tinha persistido a mutação — a
 * resposta ao Tutor/Profissional ficava presa ao tempo do push, não ao tempo
 * real da mutação. `after()` (Next.js) agenda o trabalho para DEPOIS da
 * resposta ser enviada, sem mudar nada do que é entregue (best-effort,
 * sempre foi) nem do destinatário (resolvido inteiramente server-side dentro
 * de cada notify*).
 *
 * Este teste não testa comportamento de runtime (não há como, sem um servidor
 * Next real) — testa que a INVOCAÇÃO no código-fonte continua com `after()`,
 * nunca voltando a um `await` direto que reintroduziria o bloqueio. Mesmo
 * padrão de asserção sobre código-fonte já usado em legal-documents.test.ts e
 * push-health.test.ts.
 *
 * Rodar: node --experimental-strip-types --test modules/notifications/application/push-dispatch-latency.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8")

const EVENTOS_SERVICE_REQUEST = [
  "notifyRequestCreated",
  "notifyRequestAccepted",
  "notifyServiceStarted",
  "notifyRequestCancelled",
  "notifyServiceCompleted",
] as const

describe("service-request/application/actions.ts — push agendado via after()", () => {
  const fonte = ler("modules/service-request/application/actions.ts")

  it("importa after de next/server", () => {
    assert.match(fonte, /import\s*\{\s*after\s*\}\s*from\s*"next\/server"/)
  })

  for (const nome of EVENTOS_SERVICE_REQUEST) {
    it(`${nome} é chamado via after(), nunca await direto`, () => {
      assert.match(
        fonte,
        new RegExp(`after\\(\\(\\)\\s*=>\\s*${nome}\\(`),
        `${nome} não está agendado via after() — o caminho crítico pode ter voltado a bloquear`
      )
    })

    it(`CONTROLE NEGATIVO: ${nome} não aparece mais como "await ${nome}("`, () => {
      assert.doesNotMatch(
        fonte,
        new RegExp(`\\bawait\\s+${nome}\\(`),
        `"await ${nome}(" reapareceu — reintroduziria o bloqueio que esta missão corrigiu`
      )
    })
  }
})

describe("care-timeline/application/actions.ts — push agendado via after()", () => {
  const fonte = ler("modules/care-timeline/application/actions.ts")

  it("importa after de next/server", () => {
    assert.match(fonte, /import\s*\{\s*after\s*\}\s*from\s*"next\/server"/)
  })

  it("notifyCareUpdatePublished é chamado via after(), nunca await direto", () => {
    assert.match(fonte, /after\(\(\)\s*=>\s*notifyCareUpdatePublished\(/)
  })

  it('CONTROLE NEGATIVO: notifyCareUpdatePublished não aparece mais como "await notifyCareUpdatePublished("', () => {
    assert.doesNotMatch(fonte, /\bawait\s+notifyCareUpdatePublished\(/)
  })
})

describe("nada além do push foi movido para after() por acidente", () => {
  it("recordRequestAudit continua await direto em service-request/application/actions.ts", () => {
    // Auditoria não é o alvo desta missão — só o Push, que é quem tem custo de
    // rede real (chamada externa ao push service). Mover a auditoria também
    // seria escopo não pedido e não avaliado aqui.
    const fonte = ler("modules/service-request/application/actions.ts")
    assert.match(fonte, /await recordRequestAudit\(/)
  })

  it("updateProfessionalTrust continua await direto — Trust Engine não foi tocado", () => {
    const fonte = ler("modules/service-request/application/actions.ts")
    assert.match(fonte, /await updateProfessionalTrust\(/)
  })
})
