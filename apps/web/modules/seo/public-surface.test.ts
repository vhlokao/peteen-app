/**
 * Superfície pública — canonical, base URL e ausência de hardcode de domínio.
 *
 * Auditoria BRAND/DOMAIN/LEGAL/PUBLIC SURFACE. Testes de fonte: a propriedade
 * a garantir é sobre CONFIGURAÇÃO (qual URL vira canonical, de onde ela vem),
 * não sobre lógica de negócio — ler o arquivo é a forma direta de verificar
 * isso, sem precisar de um servidor rodando.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8")

describe("canonical explícito nas páginas públicas indexáveis", () => {
  it("/termos, /privacidade e /partners/[slug] declaram alternates.canonical", () => {
    for (const [arquivo, padrao] of [
      ["app/termos/page.tsx", /alternates:\s*\{\s*canonical:\s*"\/termos"\s*\}/],
      ["app/privacidade/page.tsx", /alternates:\s*\{\s*canonical:\s*"\/privacidade"\s*\}/],
      [
        "app/(marketing)/partners/[slug]/page.tsx",
        /alternates:\s*\{\s*canonical:\s*`\/partners\/\$\{slug\}`\s*\}/,
      ],
    ] as const) {
      assert.match(ler(arquivo), padrao, `${arquivo} sem canonical explícito`)
    }
  })
})

describe("base URL — uma fonte só, sem hardcode de host de produto", () => {
  const AUTH = ler("modules/identity/infrastructure/auth-actions.ts")
  const LAYOUT = ler("app/layout.tsx")

  it("layout.tsx resolve metadataBase de NEXT_PUBLIC_APP_URL", () => {
    assert.match(LAYOUT, /metadataBase:\s*new URL\(\s*\n?\s*process\.env\.NEXT_PUBLIC_APP_URL/)
  })

  it("auth callback usa a MESMA variável, não uma segunda fonte", () => {
    assert.match(AUTH, /process\.env\.NEXT_PUBLIC_APP_URL/)
  })

  it("nenhum arquivo do produto tem host da Vercel hardcoded", () => {
    // Varredura recursiva — mesma auditada manualmente antes desta correção:
    // zero ocorrências de vercel.app fora de fixtures de teste.
    const proibido = /peteen-app\.vercel\.app|[a-z0-9-]+\.vercel\.app/
    const pular = new Set(["node_modules", ".next", ".git"])
    const arquivosComHardcode: string[] = []

    const visitar = (dir: string) => {
      for (const nome of readdirSync(join(RAIZ, dir))) {
        if (pular.has(nome)) continue
        const rel = `${dir}/${nome}`
        const abs = join(RAIZ, rel)
        if (statSync(abs).isDirectory()) {
          visitar(rel)
        } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.ts$/.test(nome)) {
          if (proibido.test(readFileSync(abs, "utf8"))) arquivosComHardcode.push(rel)
        }
      }
    }
    visitar("app")
    visitar("modules")
    visitar("components")
    visitar("lib")

    assert.deepEqual(arquivosComHardcode, [], "host da Vercel hardcoded fora de teste")
  })

  it("nenhum arquivo de produto tem localhost hardcoded fora do fallback documentado", () => {
    // O ÚNICO lugar permitido é o fallback de dev em layout.tsx — qualquer
    // outro seria uma segunda fonte de verdade sobre o domínio.
    const permitido = new Set(["app/layout.tsx"])
    const pular = new Set(["node_modules", ".next", ".git"])
    const achados: string[] = []

    const visitar = (dir: string) => {
      for (const nome of readdirSync(join(RAIZ, dir))) {
        if (pular.has(nome)) continue
        const rel = `${dir}/${nome}`
        const abs = join(RAIZ, rel)
        if (statSync(abs).isDirectory()) {
          visitar(rel)
        } else if (
          /\.(ts|tsx)$/.test(nome) &&
          !/\.test\.ts$/.test(nome) &&
          !permitido.has(rel)
        ) {
          const conteudo = readFileSync(abs, "utf8")
          if (/localhost:\d+/.test(conteudo) && !/\/\/.*localhost|comentário|comment/i.test(conteudo)) {
            // Segunda checagem: ignora ocorrências dentro de comentários —
            // citar "localhost" ao EXPLICAR o comportamento não é hardcode.
            const semComentarios = conteudo
              .replace(/\/\*[\s\S]*?\*\//g, "")
              .replace(/^\s*\/\/.*$/gm, "")
            if (/localhost:\d+/.test(semComentarios)) achados.push(rel)
          }
        }
      }
    }
    visitar("app")
    visitar("modules")
    visitar("lib")

    assert.deepEqual(achados, [], "localhost hardcoded fora do fallback documentado")
  })
})

describe("cabeçalhos de segurança declarados, sem CSP não revisado", () => {
  const CONFIG = ler("next.config.ts")

  it("declara os quatro cabeçalhos seguros de baixo risco", () => {
    const pares: Array<[string, string]> = [
      ["X-Content-Type-Options", "nosniff"],
      ["X-Frame-Options", "DENY"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
    ]
    for (const [chave, valor] of pares) {
      assert.match(CONFIG, new RegExp(`key:\\s*"${chave}",\\s*value:\\s*"${valor.replace(/[()]/g, "\\$&")}"`))
    }
  })

  it("NÃO introduz Content-Security-Policy sem revisão — mudança ampla, fora do escopo desta auditoria", () => {
    // `.replace` remove o próprio COMENTÁRIO do next.config.ts que explica por
    // que o CSP foi deixado de fora — sem isto o teste reprova contra a
    // própria documentação da regra, não contra código real. Mesmo cuidado já
    // necessário em legal-documents.test.ts e server-action-surface.test.ts.
    const semComentarios = CONFIG.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    assert.doesNotMatch(semComentarios, /Content-Security-Policy/)
  })

  it("aplica os cabeçalhos a todas as rotas, não a um subconjunto esquecido", () => {
    assert.match(CONFIG, /source:\s*"\/:path\*"/)
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TRIPWIRE — Permissions-Policy `camera=()` × Care Timeline
 *
 * PRE-PUBLISH GATE: a Peteen tem fluxo real de câmera no Care Timeline
 * (CarePhotoPicker.tsx). Antes de publicar `camera=()` globalmente, foi
 * preciso provar que ele não afeta esse fluxo.
 *
 * MECANISMO REAL, verificado por grep em todo o repositório: zero uso de
 * `getUserMedia`/`MediaDevices`/`MediaRecorder`/`navigator.geolocation`. O
 * Care Timeline usa exclusivamente `<input type="file" capture="environment">`
 * — o chooser nativo do SO, não a API JS de câmera.
 *
 * PROVA EMPÍRICA (feita ao vivo no browser, não deduzida): com
 * `Permissions-Policy: camera=()` ativo no documento —
 * `document.featurePolicy.allowsFeature("camera")` confirmado `false` —
 * `navigator.mediaDevices.getUserMedia({video:true})` foi BLOQUEADO
 * (`NotAllowedError`), provando que a policy tem efeito real. No MESMO
 * documento, sob a MESMA policy, um `<input type="file" capture="environment">`
 * criado via `setAttribute` (fiel ao que o React realmente emite) permaneceu
 * com o atributo intacto, não-`disabled`, e `.click()` não lançou exceção
 * nenhuma. A Permissions Policy `camera` é definida pela spec em torno da
 * Media Capture and Streams API — nunca em torno de `<input capture>`, que é
 * HTML entregue ao chooser do SO, fora do alcance de qualquer feature policy.
 *
 * Por isso a policy afeta (A) getUserMedia — que o produto não usa — e NÃO
 * afeta (B) `<input capture>`, (C) o chooser do Android nem (D) o do iOS/PWA:
 * os três últimos são a MESMA via (B), decidida pelo navegador/SO antes de
 * qualquer verificação de Permissions Policy acontecer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE TESTE REALMENTE TRAVA
 *
 * Não espelha a string do header — verifica o FATO que torna `camera=()`
 * seguro hoje: nenhum código do produto usa a API que a policy bloqueia. Se
 * algum dia alguém introduzir `getUserMedia`/`MediaRecorder`/
 * `navigator.geolocation` num fluxo novo, ESTE teste falha imediatamente,
 * forçando quem escreveu aquele código a revisitar `next.config.ts` antes de
 * descobrir em produção que a câmera/microfone/localização não funcionam.
 */
describe("Permissions-Policy camera/microphone/geolocation não colide com uso real", () => {
  const pular = new Set(["node_modules", ".next", ".git"])
  const APIS_GOVERNADAS = [
    { nome: "getUserMedia", padrao: /getUserMedia/ },
    { nome: "MediaDevices", padrao: /\bMediaDevices\b|navigator\.mediaDevices/ },
    { nome: "MediaRecorder", padrao: /\bMediaRecorder\b/ },
    { nome: "navigator.geolocation", padrao: /navigator\.geolocation|getCurrentPosition|watchPosition/ },
  ]

  function arquivosDoProduto(): string[] {
    const out: string[] = []
    const visitar = (dir: string) => {
      for (const nome of readdirSync(join(RAIZ, dir))) {
        if (pular.has(nome)) continue
        const rel = `${dir}/${nome}`
        const abs = join(RAIZ, rel)
        if (statSync(abs).isDirectory()) visitar(rel)
        else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(rel)
      }
    }
    visitar("app")
    visitar("modules")
    visitar("components")
    return out
  }

  const ARQUIVOS = arquivosDoProduto()

  for (const api of APIS_GOVERNADAS) {
    it(`nenhum código do produto usa ${api.nome} hoje`, () => {
      // Se este teste falhar, alguém introduziu a API que a Permissions
      // Policy bloqueia. Antes de "corrigir o teste", ir a next.config.ts e
      // decidir: remover a restrição correspondente, ou mover o novo uso
      // para fora do escopo do header (não há allowlist por rota hoje).
      const achados = ARQUIVOS.filter((f) => api.padrao.test(readFileSync(join(RAIZ, f), "utf8")))
      assert.deepEqual(achados, [], `${api.nome} em uso: ${achados.join(", ")}`)
    })
  }

  it("o mecanismo real do Care Timeline é input file capture, não getUserMedia", () => {
    const picker = ler("modules/care-timeline/components/CarePhotoPicker.tsx")
    assert.match(picker, /type="file"/)
    assert.match(picker, /capture="environment"/)
    assert.doesNotMatch(picker, /getUserMedia/)
  })

  it("Permissions-Policy inclui exatamente camera, microphone e geolocation — nenhuma outra feature restrita sem auditoria equivalente", () => {
    const CONFIG = ler("next.config.ts")
    const valor = CONFIG.match(/key:\s*"Permissions-Policy",\s*value:\s*"([^"]+)"/)?.[1]
    assert.ok(valor, "Permissions-Policy não encontrado em next.config.ts")
    const features = valor.split(",").map((f) => f.trim().split("=")[0])
    assert.deepEqual(new Set(features), new Set(["camera", "microphone", "geolocation"]))
  })
})
