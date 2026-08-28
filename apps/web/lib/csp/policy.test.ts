/**
 * Content Security Policy — contrato da política.
 *
 * Rodar: npm run test:csp
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { buildCspHeaderValue, CSP_HEADER_NAME, supabaseHostnameFromEnv } from "./policy.ts"

const NONCE = "dGVzdC1ub25jZQ=="
const SUPABASE_HOST = "xyzcompany.supabase.co"

function parse(header: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const parte of header.split(";")) {
    const [diretiva, ...fontes] = parte.trim().split(/\s+/)
    if (diretiva) out[diretiva] = fontes
  }
  return out
}

describe("CSP_HEADER_NAME — Report-Only, não enforcement", () => {
  it("é o header de relatório, não o bloqueante", () => {
    // Esta é a PRIMEIRA CSP do projeto. Promover para o header bloqueante
    // ("Content-Security-Policy", sem o sufixo) é decisão separada, tomada
    // depois de observar violações reais — não parte desta missão.
    assert.equal(CSP_HEADER_NAME, "Content-Security-Policy-Report-Only")
  })
})

describe("supabaseHostnameFromEnv", () => {
  it("extrai o hostname de uma URL válida", () => {
    assert.equal(supabaseHostnameFromEnv("https://xyzcompany.supabase.co"), "xyzcompany.supabase.co")
  })

  it("undefined/URL inválida → null, nunca lança", () => {
    assert.equal(supabaseHostnameFromEnv(undefined), null)
    assert.equal(supabaseHostnameFromEnv("não é uma url"), null)
  })
})

describe("diretivas restritivas presentes, exatamente como preferido", () => {
  const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" })
  const d = parse(header)

  it("object-src 'none'", () => {
    assert.deepEqual(d["object-src"], ["'none'"])
  })
  it("base-uri 'self'", () => {
    assert.deepEqual(d["base-uri"], ["'self'"])
  })
  it("frame-ancestors 'none'", () => {
    assert.deepEqual(d["frame-ancestors"], ["'none'"])
  })
  it("frame-src 'none' — nenhum iframe no produto, OAuth é redirect top-level", () => {
    assert.deepEqual(d["frame-src"], ["'none'"])
  })
  it("default-src 'self'", () => {
    assert.deepEqual(d["default-src"], ["'self'"])
  })
  it("form-action 'self'", () => {
    assert.deepEqual(d["form-action"], ["'self'"])
  })
})

describe("nenhum wildcard global — nenhuma diretiva é '*' sozinho", () => {
  const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" })
  const d = parse(header)

  for (const diretiva of Object.keys(d)) {
    it(`${diretiva} não é '*' isolado`, () => {
      assert.ok(!d[diretiva]!.includes("*"), `${diretiva} contém '*' — proibido pelo briefing`)
    })
  }

  it("connect-src NUNCA é '*' — teria que ser consumidor por consumidor", () => {
    assert.ok(!d["connect-src"]!.includes("*"))
  })
})

describe("nonce presente e propagado só onde faz sentido", () => {
  const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" })
  const d = parse(header)

  it("script-src carrega o nonce exato passado", () => {
    assert.ok(d["script-src"]!.includes(`'nonce-${NONCE}'`))
  })

  it("script-src tem 'strict-dynamic' — scripts do Next podem carregar chunks", () => {
    assert.ok(d["script-src"]!.includes("'strict-dynamic'"))
  })

  it("nonce NÃO aparece em outra diretiva além de script-src", () => {
    for (const [diretiva, fontes] of Object.entries(d)) {
      if (diretiva === "script-src") continue
      assert.ok(!fontes.some((f) => f.includes(NONCE)), `nonce vazou para ${diretiva}`)
    }
  })
})

describe("origens necessárias presentes — cada uma com consumidor real", () => {
  const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" })
  const d = parse(header)
  const supabaseUrl = `https://${SUPABASE_HOST}`

  it("connect-src inclui o Supabase — auth client-side (onAuthStateChange/signOut)", () => {
    assert.ok(d["connect-src"]!.includes(supabaseUrl))
  })

  it("media-src inclui o Supabase — vídeo do Care Timeline (signed URL)", () => {
    assert.ok(d["media-src"]!.includes(supabaseUrl))
  })

  it("media-src inclui blob: — preview local de vídeo antes do upload", () => {
    assert.ok(d["media-src"]!.includes("blob:"))
  })

  it("img-src inclui blob: — preview local de foto antes do upload", () => {
    assert.ok(d["img-src"]!.includes("blob:"))
  })

  it("worker-src 'self' — registro do Service Worker em /sw.js", () => {
    assert.deepEqual(d["worker-src"], ["'self'"])
  })

  it("manifest-src 'self' — /manifest.webmanifest é rota do próprio app", () => {
    assert.deepEqual(d["manifest-src"], ["'self'"])
  })

  it("font-src é SÓ 'self' — next/font/google não busca fonts.gstatic em runtime", () => {
    // Regressão que este teste evita: alguém "corrigir" isto adicionando
    // fonts.googleapis.com/fonts.gstatic.com por hábito, sem checar que
    // next/font já auto-hospeda a fonte no build.
    assert.deepEqual(d["font-src"], ["'self'"])
  })
})

describe("origens NÃO usadas ficam de fora — nenhuma sem consumidor comprovado", () => {
  const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" })

  for (const proibido of [
    "posthog",
    "app.posthog.com",
    "maps.googleapis.com",
    "sentry.io",
    "ingest.sentry.io",
    "accounts.google.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
  ]) {
    it(`"${proibido}" não aparece em lugar nenhum da política`, () => {
      // Nenhum destes tem import/consumidor real no código — grep confirmado
      // na auditoria da missão. Uma origem aqui sem uso é superfície aberta
      // à toa.
      assert.ok(!header.includes(proibido), `${proibido} apareceu sem consumidor`)
    })
  }
})

describe("dev vs produção — a exceção de dev nunca vaza", () => {
  it("'unsafe-eval' presente em development (HMR/React Refresh)", () => {
    const d = parse(buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "development" }))
    assert.ok(d["script-src"]!.includes("'unsafe-eval'"))
  })

  it("'unsafe-eval' AUSENTE em production — a regressão que mais importa aqui", () => {
    const d = parse(buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" }))
    assert.ok(!d["script-src"]!.includes("'unsafe-eval'"))
  })
})

describe("nenhum vercel.app/localhost hardcoded na política", () => {
  it("supabaseHostname ausente não quebra a política nem deixa buraco", () => {
    const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: null, environment: "production" })
    assert.doesNotThrow(() => header)
    assert.ok(!header.includes("undefined"))
    // Sem host, connect-src/media-src caem para só 'self' — nunca um '*'
    // para "compensar" a ausência.
    const d = parse(header)
    assert.deepEqual(d["connect-src"], ["'self'"])
  })

  it("a política nunca contém vercel.app ou localhost — só a env, resolvida em runtime", () => {
    const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" })
    assert.ok(!header.includes("vercel.app"))
    assert.ok(!header.includes("localhost"))
  })
})

describe("img-src — a exceção deliberada, e só ela", () => {
  const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" })
  const d = parse(header)

  it("img-src inclui https: — Partner.logoUrl é URL arbitrária digitada pelo próprio parceiro", () => {
    // Única diretiva com fonte de escopo largo nesta política, e por motivo
    // específico: modules/partners permite qualquer host HTTPS para o logo.
    // Restringir quebraria esse preview hoje. Documentado no relatório da
    // missão como ponto a revisitar se o logo passar a ser upload
    // server-side (como já é a foto de pet).
    assert.ok(d["img-src"]!.includes("https:"))
  })

  it("mas nunca http: nem um curinga fora de escopo (data:, javascript:)", () => {
    assert.ok(!d["img-src"]!.includes("http:"))
    assert.ok(!d["img-src"]!.includes("*"))
    assert.ok(!d["img-src"]!.includes("data:"))
  })

  it("nenhuma OUTRA diretiva repete essa largura — a exceção fica contida", () => {
    for (const [diretiva, fontes] of Object.entries(d)) {
      if (diretiva === "img-src") continue
      assert.ok(!fontes.includes("https:"), `${diretiva} também abriu https: — a exceção vazou`)
    }
  })
})

describe("style-src — 'unsafe-inline' justificado, não wildcard nem eval", () => {
  const header = buildCspHeaderValue({ nonce: NONCE, supabaseHostname: SUPABASE_HOST, environment: "production" })
  const d = parse(header)

  it("style-src tem 'unsafe-inline' — prop style={{}} do React em uso real", () => {
    assert.ok(d["style-src"]!.includes("'unsafe-inline'"))
  })

  it("mas 'unsafe-eval' nunca aparece em style-src", () => {
    assert.ok(!d["style-src"]!.includes("'unsafe-eval'"))
  })
})
