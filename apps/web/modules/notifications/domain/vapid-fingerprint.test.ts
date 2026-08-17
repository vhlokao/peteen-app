/**
 * Incidente Push Reliability — isolamento cross-environment de push.
 *
 * A identidade de uma subscription tem DOIS eixos e os dois são verificados:
 *
 *   runtimeEnvironment  → estágio  (production | preview | development)
 *   vapidKeyFingerprint → par VAPID
 *
 * O teste central deste arquivo (bloco "TESTE CENTRAL DE SEGURANÇA") é o que
 * prova que o fingerprint sozinho não bastava: com a MESMA chave nos dois lados,
 * um sender de preview ou de development não alcança um device de produção.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  avaliarElegibilidade,
  canonicalizarChavePublicaVapid,
  VAPID_FINGERPRINT_LENGTH,
  vapidFingerprintFromPublicKey,
  type PushRuntimeEnvironment,
} from "./vapid-fingerprint.ts"

/** Chaves P-256 reais (públicas — não são segredo) dos dois ambientes. */
const PUB_PROD = "BNQ0JwriBQaGAnomJD-cMXCzZM5CpzWLBZOZ2orjn1i4w7VY2dAy08nxXpcHw98hxyCUfbOourOQwDPvOsVpgOw"
const PUB_LOCAL = "BMFXlHjD8dyXkQv7hVJH5nQZ8pXvKZ1YQm7cW3xR2tN4bL6jP9aS0dF8gH5kM2nQ7rT4vX1yZ3cB6eA9wU8iO0k"

/** X = a chave COMPARTILHADA. Quase todo este arquivo a usa: o cenário difícil
 *  é justamente aquele em que a criptografia não distingue nada. */
const X = vapidFingerprintFromPublicKey(PUB_PROD)
const OUTRA = vapidFingerprintFromPublicKey(PUB_LOCAL)

type Ambiente = PushRuntimeEnvironment

/** Subscription (fingerprint, ambiente) × sender (fingerprint, ambiente). */
const eleg = (
  sub: [string | null, string | null],
  sender: [string, Ambiente]
) =>
  avaliarElegibilidade({
    subscriptionFingerprint: sub[0],
    subscriptionEnvironment: sub[1],
    senderFingerprint: sender[0],
    senderEnvironment: sender[1],
  })

const motivoDe = (r: ReturnType<typeof eleg>) => r.motivo

// ─────────────────────────────────────────────────────────────────────────────
// Formato do fingerprint
// ─────────────────────────────────────────────────────────────────────────────

describe("fingerprint — formato e determinismo", () => {
  it("é SHA-256 hex de 64 caracteres", () => {
    assert.equal(X.length, VAPID_FINGERPRINT_LENGTH)
    assert.match(X, /^[a-f0-9]{64}$/)
  })

  it("é determinístico", () => {
    assert.equal(vapidFingerprintFromPublicKey(PUB_PROD), X)
  })

  it("chaves diferentes produzem fingerprints diferentes", () => {
    assert.notEqual(X, OUTRA)
  })

  it("a MESMA chave em encodings diferentes produz o MESMO fingerprint", () => {
    // O erro que este teste impede: hashear a string crua faria a mesma chave
    // ter fingerprints distintos conforme quem a escreveu no `.env`, e o
    // dispatcher recusaria uma subscription válida.
    const base64Classico = PUB_PROD.replace(/-/g, "+").replace(/_/g, "/")
    assert.equal(vapidFingerprintFromPublicKey(base64Classico), X)
    assert.equal(vapidFingerprintFromPublicKey(base64Classico + "="), X)
    assert.equal(vapidFingerprintFromPublicKey(`  ${PUB_PROD}  `), X)
  })

  it("a forma canônica é base64url sem padding", () => {
    const c = canonicalizarChavePublicaVapid(PUB_PROD.replace(/-/g, "+").replace(/_/g, "/"))
    assert.ok(!c.includes("+") && !c.includes("/") && !c.includes("="))
    assert.equal(c, PUB_PROD)
  })

  it("nunca deriva da chave privada — só a pública entra", () => {
    // Trava de contrato: a assinatura recebe UM parâmetro, a pública.
    assert.equal(vapidFingerprintFromPublicKey.length, 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TESTE CENTRAL DE SEGURANÇA — mesma VAPID, ambientes diferentes
// ─────────────────────────────────────────────────────────────────────────────

describe("TESTE CENTRAL DE SEGURANÇA — device de produção, sender de outro estágio, MESMA chave", () => {
  it("sender PREVIEW não alcança device de PRODUÇÃO", () => {
    // Este é o achado do Security Focal. Antes do runtimeEnvironment o
    // veredito aqui era `eligible: true` — as chaves batem, e a criptografia
    // sozinha não tem como saber que o sender é um deploy de branch.
    const r = eleg([X, "production"], [X, "preview"])
    assert.equal(r.eligible, false)
    assert.equal(motivoDe(r), "environment_divergente")
  })

  it("sender DEVELOPMENT não alcança device de PRODUÇÃO", () => {
    const r = eleg([X, "production"], [X, "development"])
    assert.equal(r.eligible, false)
    assert.equal(motivoDe(r), "environment_divergente")
  })

  it("o motivo NÃO é de falha nem de revogação — é skip", () => {
    // Vocabulário deliberadamente limitado: esta função não tem como pedir
    // revogação nem sinalizar erro de entrega. Uma subscription de outro
    // estágio é VÁLIDA — só não é deste sender.
    for (const env of ["preview", "development"] as const) {
      const r = eleg([X, "production"], [X, env])
      assert.deepEqual(Object.keys(r).sort(), ["eligible", "motivo"])
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Matriz cross-environment obrigatória
// ─────────────────────────────────────────────────────────────────────────────

describe("matriz cross-environment — todos com a MESMA chave VAPID", () => {
  const casos: Array<[string, Ambiente, Ambiente, boolean, string]> = [
    ["PROD sub + PROD sender", "production", "production", true, "identidade_compativel"],
    ["PROD sub + PREVIEW sender", "production", "preview", false, "environment_divergente"],
    ["PROD sub + DEV sender", "production", "development", false, "environment_divergente"],
    ["PREVIEW sub + PROD sender", "preview", "production", false, "environment_divergente"],
    ["DEV sub + PROD sender", "development", "production", false, "environment_divergente"],
    ["PREVIEW sub + PREVIEW sender", "preview", "preview", true, "identidade_compativel"],
    ["DEV sub + DEV sender", "development", "development", true, "identidade_compativel"],
    ["PREVIEW sub + DEV sender", "preview", "development", false, "environment_divergente"],
  ]

  for (const [nome, subEnv, senderEnv, esperado, motivo] of casos) {
    it(`${nome} → ${esperado ? "envia" : "skip"}`, () => {
      const r = eleg([X, subEnv], [X, senderEnv])
      assert.equal(r.eligible, esperado)
      assert.equal(motivoDe(r), motivo)
    })
  }

  it("qualquer ambiente + fingerprint DIFERENTE → skip", () => {
    const ambientes: Ambiente[] = ["production", "preview", "development"]
    for (const subEnv of ambientes) {
      for (const senderEnv of ambientes) {
        const r = eleg([OUTRA, subEnv], [X, senderEnv])
        assert.equal(r.eligible, false, `${subEnv} → ${senderEnv}`)
      }
    }
  })

  it("mesmo ambiente + chave errada é nomeado como fingerprint_divergente", () => {
    // A distinção importa para triagem: ambiente divergente é esperado; chave
    // errada DENTRO do mesmo estágio é alarme de configuração.
    const r = eleg([OUTRA, "production"], [X, "production"])
    assert.equal(motivoDe(r), "fingerprint_divergente")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Identidade legada e PARCIAL — nada conhecido pode ser relaxado
// ─────────────────────────────────────────────────────────────────────────────

describe("A. identidade ausente (null / null)", () => {
  it("sender DEV → skip", () => {
    const r = eleg([null, null], [X, "development"])
    assert.equal(r.eligible, false)
    assert.equal(motivoDe(r), "legacy_fora_de_producao")
  })

  it("sender PREVIEW → skip", () => {
    const r = eleg([null, null], [X, "preview"])
    assert.equal(r.eligible, false)
    assert.equal(motivoDe(r), "legacy_fora_de_producao")
  })

  it("sender PROD → tentativa legacy controlada", () => {
    const r = eleg([null, null], [X, "production"])
    assert.equal(r.eligible, true)
    assert.equal(motivoDe(r), "legacy_producao")
  })

  it("`legacy_producao` é distinguível de identidade provada — é o que dispara a adoção", () => {
    // O dispatcher só grava identidade quando o envio é ACEITO, e só para as
    // linhas cujo motivo foi `legacy_producao`. Se os dois motivos colidissem,
    // uma linha já completa seria reescrita a cada entrega.
    assert.notEqual(
      motivoDe(eleg([null, null], [X, "production"])),
      motivoDe(eleg([X, "production"], [X, "production"]))
    )
  })
})

describe("B. identidade parcial — fingerprint preenchido, ambiente null", () => {
  it("PROD + fingerprint que BATE → tentativa legacy", () => {
    const r = eleg([X, null], [X, "production"])
    assert.equal(r.eligible, true)
    assert.equal(motivoDe(r), "legacy_producao")
  })

  it("PROD + fingerprint DIVERGENTE → skip (o eixo conhecido não é relaxado)", () => {
    const r = eleg([OUTRA, null], [X, "production"])
    assert.equal(r.eligible, false)
    assert.equal(motivoDe(r), "fingerprint_divergente")
  })

  it("PREVIEW e DEV → skip mesmo com o fingerprint batendo", () => {
    for (const env of ["preview", "development"] as const) {
      const r = eleg([X, null], [X, env])
      assert.equal(r.eligible, false, env)
      assert.equal(motivoDe(r), "legacy_fora_de_producao")
    }
  })
})

describe("C. identidade parcial — ambiente preenchido, fingerprint null", () => {
  it("ambiente production + sender PROD → tentativa legacy", () => {
    const r = eleg([null, "production"], [X, "production"])
    assert.equal(r.eligible, true)
    assert.equal(motivoDe(r), "legacy_producao")
  })

  it("ambiente preview + sender PROD → skip (o eixo conhecido não é relaxado)", () => {
    const r = eleg([null, "preview"], [X, "production"])
    assert.equal(r.eligible, false)
    assert.equal(motivoDe(r), "environment_divergente")
  })

  it("ambiente production + sender PREVIEW/DEV → skip", () => {
    for (const env of ["preview", "development"] as const) {
      const r = eleg([null, "production"], [X, env])
      assert.equal(r.eligible, false, env)
      assert.equal(motivoDe(r), "environment_divergente")
    }
  })
})

describe("identidade parcial — a regra nunca depende da ORDEM dos eixos", () => {
  it("um eixo conhecido que contradiz o sender basta para pular, com o outro null", () => {
    // Prova de que a verificação é por eixo, não um `if` sobre identidade
    // completa: em ambos os casos falta metade da identidade, e ainda assim a
    // metade presente decide.
    assert.equal(eleg([OUTRA, null], [X, "production"]).eligible, false)
    assert.equal(eleg([null, "preview"], [X, "production"]).eligible, false)
  })
})

describe("ambiente desconhecido gravado por versão futura → skip, nunca legado", () => {
  it("um rótulo não reconhecido não degrada para tentativa legacy", () => {
    // `subscriptionEnvironment` é comparado como string justamente por isto:
    // normalizar o desconhecido para `null` o transformaria em legado e
    // permitiria que produção tentasse enviar. O erro seguro é não enviar.
    const r = eleg([X, "staging"], [X, "production"])
    assert.equal(r.eligible, false)
    assert.equal(motivoDe(r), "environment_divergente")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Multi-device
// ─────────────────────────────────────────────────────────────────────────────

describe("multi-device — mesmo usuário, três estágios, MESMA chave pública", () => {
  const devices = [
    { nome: "celular de produção", sub: [X, "production"] as [string, string] },
    { nome: "device aberto no preview", sub: [X, "preview"] as [string, string] },
    { nome: "browser local de QA", sub: [X, "development"] as [string, string] },
  ]

  const alcancadosPor = (senderEnv: Ambiente) =>
    devices.filter((d) => eleg(d.sub, [X, senderEnv]).eligible).map((d) => d.nome)

  it("sender PROD alcança só o device de produção", () => {
    assert.deepEqual(alcancadosPor("production"), ["celular de produção"])
  })

  it("sender PREVIEW alcança só o device de preview", () => {
    assert.deepEqual(alcancadosPor("preview"), ["device aberto no preview"])
  })

  it("sender DEV alcança só o device local", () => {
    assert.deepEqual(alcancadosPor("development"), ["browser local de QA"])
  })

  it("o skip de um device não interfere no veredito dos demais", () => {
    // A avaliação é por linha, sem estado compartilhado: intercalar um device
    // inelegível não muda o resultado do elegível antes nem depois dele.
    assert.equal(eleg([X, "production"], [X, "production"]).eligible, true)
    assert.equal(eleg([X, "preview"], [X, "production"]).eligible, false)
    assert.equal(eleg([X, "production"], [X, "production"]).eligible, true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regressão do incidente original e robustez
// ─────────────────────────────────────────────────────────────────────────────

describe("incidente original — subscription de produção vista pelo dispatcher local", () => {
  it("chaves diferentes: 0 tentativas em vez de 403 do FCM", () => {
    // O caso real de 16/08: produção e localhost com pares distintos sobre o
    // mesmo Supabase. `PushDelivery` acumulava `failed` em silêncio.
    const legada = eleg([null, null], [OUTRA, "development"])
    assert.equal(legada.eligible, false)

    const identificada = eleg([X, "production"], [OUTRA, "development"])
    assert.equal(identificada.eligible, false)
  })
})

describe("robustez — nenhuma combinação lança e nada relaxa", () => {
  it("varre fingerprint × ambiente × sender", () => {
    const fps: (string | null)[] = [null, X, OUTRA]
    const envsSub: (string | null)[] = [null, "production", "preview", "development", "staging"]
    const envsSender: Ambiente[] = ["production", "preview", "development"]

    for (const f of fps) {
      for (const e of envsSub) {
        for (const se of envsSender) {
          const r = eleg([f, e], [X, se])
          assert.equal(typeof r.eligible, "boolean", `${f}/${e}/${se}`)
          assert.ok(typeof r.motivo === "string")

          // Invariante de segurança: nada é elegível quando um eixo conhecido
          // contradiz o sender.
          if ((f !== null && f !== X) || (e !== null && e !== se)) {
            assert.equal(r.eligible, false, `deveria pular: ${f}/${e}/${se}`)
          }
          // Invariante de contenção: fora de produção, só identidade COMPLETA
          // e coincidente pode passar.
          if (se !== "production" && r.eligible) {
            assert.equal(motivoDe(r), "identidade_compativel", `${f}/${e}/${se}`)
            assert.notEqual(f, null)
            assert.notEqual(e, null)
          }
        }
      }
    }
  })
})
