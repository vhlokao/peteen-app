/**
 * Push Subscription Health — estado canônico do dispositivo.
 *
 * O teste central deste arquivo é "ATIVADO exige concordância dos dois lados":
 * é a regressão que a missão corrige. Antes, o browser sozinho decidia, e uma
 * subscription revogada no servidor deixava a tela afirmando "Notificações
 * ativadas" indefinidamente.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import {
  avaliarSaudePush,
  copyAfirmaQueEstaAtivo,
  deveReconciliarAgora,
  PUSH_HEALTH_STATES,
  PUSH_RECONCILIATION_MIN_INTERVAL_MS,
  resolvePushHealthCopy,
  type ObservacaoBrowser,
  type ObservacaoServidor,
} from "./push-health.ts"

/** Browser saudável. Cada teste sobrescreve só o eixo que está exercitando. */
const OK: ObservacaoBrowser = {
  suportado: true,
  iosForaDaTelaInicio: false,
  configurado: true,
  permissao: "granted",
  temSubscriptionLocal: true,
  optOutLocal: false,
}

const SERVIDOR_OK: ObservacaoServidor = { consultado: true, ativaNesteDispositivo: true }
const SERVIDOR_SEM: ObservacaoServidor = { consultado: true, ativaNesteDispositivo: false }
const SERVIDOR_MUDO: ObservacaoServidor = { consultado: false }

const saude = (b: Partial<ObservacaoBrowser>, s: ObservacaoServidor = SERVIDOR_OK) =>
  avaliarSaudePush({ ...OK, ...b }, s)

// ─────────────────────────────────────────────────────────────────────────────
// TESTE CENTRAL — a regressão que originou a missão
// ─────────────────────────────────────────────────────────────────────────────

describe("ATIVADO exige concordância do browser E do servidor", () => {
  it("os dois lados válidos → ACTIVE", () => {
    const r = saude({}, SERVIDOR_OK)
    assert.equal(r.state, "ACTIVE")
    assert.equal(r.reason, "saudavel")
  })

  it("subscription local viva + servidor SEM a linha → NEEDS_REPAIR, nunca ACTIVE", () => {
    const r = saude({}, SERVIDOR_SEM)
    assert.equal(r.state, "NEEDS_REPAIR")
    assert.equal(r.reason, "sem_subscription_no_servidor")
    // É o caso do falso "Ativado": o browser sozinho diria que está tudo bem.
    assert.notEqual(r.state, "ACTIVE")
  })

  it("o reparo deste caso NÃO precisa criar subscription no browser", () => {
    // A local existe e é reaproveitável — basta re-registrá-la no servidor.
    assert.equal(saude({}, SERVIDOR_SEM).precisaSubscribeLocal, false)
    assert.equal(saude({}, SERVIDOR_SEM).autoReparavel, true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Relogin — permissão concedida, subscription perdida no logout
// ─────────────────────────────────────────────────────────────────────────────

describe("relogin no mesmo aparelho", () => {
  it("granted sem subscription local → NEEDS_REPAIR auto-reparável", () => {
    const r = saude({ temSubscriptionLocal: false }, SERVIDOR_MUDO)
    assert.equal(r.state, "NEEDS_REPAIR")
    assert.equal(r.reason, "sem_subscription_local")
    assert.equal(r.autoReparavel, true)
    assert.equal(r.precisaSubscribeLocal, true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Falha de consulta não pode virar alarme
// ─────────────────────────────────────────────────────────────────────────────

describe("servidor não consultado", () => {
  it("preserva ACTIVE em vez de acusar reparo", () => {
    const r = saude({}, SERVIDOR_MUDO)
    assert.equal(r.state, "ACTIVE")
    assert.equal(r.reason, "servidor_nao_consultado")
    // Um blip de rede não pode pedir reparo — seria alarme falso recorrente.
    assert.equal(r.autoReparavel, false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Opt-out deliberado × reparo automático
// ─────────────────────────────────────────────────────────────────────────────

describe("opt-out do usuário", () => {
  it("desativado de propósito → DISABLED, e NUNCA auto-reparável", () => {
    const r = saude({ temSubscriptionLocal: false, optOutLocal: true }, SERVIDOR_SEM)
    assert.equal(r.state, "DISABLED")
    assert.equal(r.reason, "desativado_pelo_usuario")
    // Esta é a asserção que impede o religamento silencioso do que a pessoa
    // acabou de desligar.
    assert.equal(r.autoReparavel, false)
  })

  it("sem a marca, o MESMO estado técnico é NEEDS_REPAIR", () => {
    // Prova que a única diferença entre "desativei" e "perdi no relogin" é a
    // intenção registrada — os dois eixos observáveis são idênticos.
    const r = saude({ temSubscriptionLocal: false, optOutLocal: false }, SERVIDOR_SEM)
    assert.equal(r.state, "NEEDS_REPAIR")
    assert.equal(r.autoReparavel, true)
  })

  it("a marca NÃO vence a realidade: push funcionando continua ACTIVE", () => {
    const r = saude({ optOutLocal: true }, SERVIDOR_OK)
    assert.equal(r.state, "ACTIVE")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Permissão manda antes de qualquer sinal de subscription
// ─────────────────────────────────────────────────────────────────────────────

describe("permissão", () => {
  it("denied → DENIED mesmo com subscription local sobrando", () => {
    const r = saude({ permissao: "denied", temSubscriptionLocal: true }, SERVIDOR_OK)
    assert.equal(r.state, "DENIED")
    assert.equal(r.autoReparavel, false)
  })

  it("default → DISABLED (nunca perguntamos)", () => {
    const r = saude({ permissao: "default", temSubscriptionLocal: false }, SERVIDOR_MUDO)
    assert.equal(r.state, "DISABLED")
    assert.equal(r.reason, "nunca_ativado")
  })

  it("nenhum estado sem permissão granted é auto-reparável", () => {
    // Trava dura: auto-repair jamais pode rodar sem permissão já concedida,
    // porque `subscribe()` nesse caso poderia disparar o prompt nativo — e um
    // `denied` é permanente no browser.
    for (const permissao of ["denied", "default"] as const) {
      assert.equal(saude({ permissao }, SERVIDOR_SEM).autoReparavel, false, permissao)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sem suporte / sem configuração
// ─────────────────────────────────────────────────────────────────────────────

describe("UNSUPPORTED", () => {
  it("navegador sem as APIs", () => {
    const r = saude({ suportado: false }, SERVIDOR_MUDO)
    assert.equal(r.state, "UNSUPPORTED")
    assert.equal(r.reason, "navegador_sem_suporte")
  })

  it("iOS fora da Tela de Início tem razão própria", () => {
    const r = saude({ suportado: false, iosForaDaTelaInicio: true }, SERVIDOR_MUDO)
    assert.equal(r.state, "UNSUPPORTED")
    assert.equal(r.reason, "ios_fora_da_tela_inicio")
  })

  it("ambiente sem VAPID não culpa o navegador", () => {
    const r = saude({ configurado: false }, SERVIDOR_MUDO)
    assert.equal(r.state, "UNSUPPORTED")
    assert.equal(r.reason, "ambiente_nao_configurado")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// COPY — a trava contra o retorno do falso "Ativado"
// ─────────────────────────────────────────────────────────────────────────────

describe("copy", () => {
  it("SÓ ACTIVE pode afirmar que as notificações estão ativadas", () => {
    const cenarios: Array<[string, ObservacaoBrowser, ObservacaoServidor]> = [
      ["needs_repair_servidor", OK, SERVIDOR_SEM],
      ["needs_repair_local", { ...OK, temSubscriptionLocal: false }, SERVIDOR_MUDO],
      ["denied", { ...OK, permissao: "denied" }, SERVIDOR_MUDO],
      ["default", { ...OK, permissao: "default" }, SERVIDOR_MUDO],
      ["optout", { ...OK, temSubscriptionLocal: false, optOutLocal: true }, SERVIDOR_SEM],
      ["sem_suporte", { ...OK, suportado: false }, SERVIDOR_MUDO],
      ["ios", { ...OK, suportado: false, iosForaDaTelaInicio: true }, SERVIDOR_MUDO],
      ["sem_vapid", { ...OK, configurado: false }, SERVIDOR_MUDO],
    ]

    for (const [nome, browser, servidor] of cenarios) {
      const s = avaliarSaudePush(browser, servidor)
      assert.notEqual(s.state, "ACTIVE", nome)
      assert.equal(
        copyAfirmaQueEstaAtivo(resolvePushHealthCopy(s)),
        false,
        `${nome} afirma estar ativo: "${resolvePushHealthCopy(s).titulo}"`
      )
    }
  })

  it("ACTIVE afirma, e é o único", () => {
    const s = avaliarSaudePush(OK, SERVIDOR_OK)
    assert.equal(copyAfirmaQueEstaAtivo(resolvePushHealthCopy(s)), true)
  })

  it("todo estado tem copy não vazia", () => {
    for (const state of PUSH_HEALTH_STATES) {
      const copy = resolvePushHealthCopy({
        state,
        reason: "saudavel",
        autoReparavel: false,
        precisaSubscribeLocal: false,
      })
      assert.ok(copy.titulo.length > 0, state)
    }
  })

  it('"desativadas" e "reativadas" não contam como afirmação de saúde', () => {
    // Guarda do `\b` inicial da regex: sem ele as duas copies que dizem o
    // CONTRÁRIO seriam lidas como afirmação de que push funciona.
    assert.equal(copyAfirmaQueEstaAtivo({ titulo: "Notificações desativadas", detalhe: null }), false)
    assert.equal(
      copyAfirmaQueEstaAtivo({ titulo: "Notificações precisam ser reativadas", detalhe: null }),
      false
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cadência — sem polling
// ─────────────────────────────────────────────────────────────────────────────

describe("deveReconciliarAgora", () => {
  const AGORA = 1_800_000_000_000

  it("primeira vez na sessão sempre reconcilia (é o caso pós-login)", () => {
    assert.equal(deveReconciliarAgora(null, AGORA), true)
  })

  it("dentro da janela, não", () => {
    assert.equal(deveReconciliarAgora(AGORA - 1000, AGORA), false)
    assert.equal(
      deveReconciliarAgora(AGORA - PUSH_RECONCILIATION_MIN_INTERVAL_MS + 1, AGORA),
      false
    )
  })

  it("no limite exato, sim", () => {
    assert.equal(deveReconciliarAgora(AGORA - PUSH_RECONCILIATION_MIN_INTERVAL_MS, AGORA), true)
  })

  it("carimbo no futuro não trava a reconciliação para sempre", () => {
    assert.equal(deveReconciliarAgora(AGORA + 999_999, AGORA), true)
  })

  it("a janela é grande o bastante para não ser polling", () => {
    assert.ok(PUSH_RECONCILIATION_MIN_INTERVAL_MS >= 5 * 60 * 1000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TRAVAS ESTRUTURAIS — o que não dá para testar sem browser
// ─────────────────────────────────────────────────────────────────────────────

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")

function codigoSemComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}
const ler = (rel: string) => codigoSemComentarios(readFileSync(join(RAIZ, rel), "utf8"))

describe("travas estruturais do auto-repair", () => {
  it("o reparo NUNCA pede permissão", () => {
    // Sem jsdom não dá para montar; o que dá para garantir é que a chamada não
    // existe em nenhum dos arquivos do caminho automático.
    for (const arquivo of [
      "lib/push/repair.ts",
      "lib/push/opt-out.ts",
      "modules/notifications/components/push-health-reconciler.tsx",
    ]) {
      assert.ok(
        !ler(arquivo).includes("requestPermission"),
        `${arquivo} pede permissão — só o PushOptIn pode, e só no clique`
      )
    }
  })

  it("repararPush exige permission granted antes de qualquer trabalho", () => {
    const fonte = ler("lib/push/repair.ts")
    const guarda = fonte.indexOf('Notification.permission !== "granted"')
    assert.ok(guarda > 0, "a guarda de permissão sumiu de repararPush")

    // A guarda precisa vir ANTES de qualquer trabalho real. Procura a CHAMADA
    // (`nome(`), nunca o identificador solto — este casaria com a linha de
    // import no topo do arquivo e o teste passaria/falharia por acidente.
    for (const chamada of ["registrarServiceWorker()", "assinar("]) {
      const uso = fonte.indexOf(chamada)
      assert.ok(uso > guarda, `${chamada} acontece antes da guarda de permissão`)
    }
  })

  it("o reconciliador não faz polling", () => {
    const fonte = ler("modules/notifications/components/push-health-reconciler.tsx")
    assert.ok(!fonte.includes("setInterval"), "polling proibido")
    assert.ok(!fonte.includes("setTimeout"), "timer disfarçado de polling proibido")
  })

  it("o logout NÃO marca opt-out — é o que faz o push voltar no relogin", () => {
    for (const arquivo of ["lib/push/logout.ts", "lib/push/sign-out.ts"]) {
      assert.ok(
        !ler(arquivo).includes("marcarOptOutLocal"),
        `${arquivo} marcaria logout como opt-out e o push nunca voltaria`
      )
    }
  })
})
