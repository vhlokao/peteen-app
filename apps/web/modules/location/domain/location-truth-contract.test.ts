/**
 * GATE-15-LOCATION-DISCOVERY-GROWTH-TRUTH-001 — contrato de verdade territorial.
 *
 * Este arquivo trava três coisas que a auditoria PROVOU com leitura em PROD:
 *
 *   1. geo interno (`lat`/`lng`/`serviceRadiusKm`) não pode voltar à projeção
 *      pública — a política de privacidade depende disso e o doc chegou a
 *      afirmar, errado, que ainda estava exposto;
 *   2. nenhuma promessa de proximidade/bairro/região onde o filtro é por
 *      CIDADE e as FKs territoriais estão vazias (0 de 21 perfis);
 *   3. erro de query no Growth não pode virar métrica de negócio zerada — a
 *      mesma regra que o Gate 14 estabeleceu para o Backoffice.
 *
 * Rodar: npm run test:location
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}
const ler = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"))
const lerCru = (rel: string) => readFileSync(join(RAIZ, rel), "utf8")

const TIPOS_PRO = ler("modules/professional/domain/types.ts")
const REPO_PRO = ler("modules/professional/infrastructure/repository.ts")
const REPO_GROWTH = ler("modules/growth-engine/infrastructure/repository.ts")
const PAGINA_GROWTH = ler("app/(admin)/admin/growth/page.tsx")
const CTA_TUTOR = ler("modules/tutor-portal/infrastructure/queries.ts")

// ─────────────────────────────────────────────────────────────────────────────
// Privacidade — geo interno nunca sai
// ─────────────────────────────────────────────────────────────────────────────

describe("projeção pública não carrega geo interno", () => {
  it("o tipo público exclui lat, lng e serviceRadiusKm", () => {
    const trecho = TIPOS_PRO.slice(TIPOS_PRO.indexOf("ProfessionalPublicProfile = Omit<"))
    for (const campo of ["lat", "lng", "serviceRadiusKm", "phone", "userId"]) {
      assert.match(
        trecho.slice(0, 400),
        new RegExp(`"${campo}"`),
        `${campo} saiu da lista de Omit da projeção pública`
      )
    }
  })

  it("as duas leituras públicas montam o retorno em allowlist, sem geo", () => {
    for (const fn of ["findPublicProfessionalById", "findPublicProfessionals"]) {
      const inicio = REPO_PRO.indexOf(`export async function ${fn}(`)
      assert.ok(inicio > 0, `${fn} não encontrada`)
      const fim = REPO_PRO.indexOf("\nexport ", inicio + 10)
      const corpo = REPO_PRO.slice(inicio, fim === -1 ? undefined : fim)
      for (const campo of ["lat:", "lng:", "serviceRadiusKm:"]) {
        assert.ok(!corpo.includes(campo), `${fn} devolve ${campo}`)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Nenhuma promessa que o dado não sustenta
// ─────────────────────────────────────────────────────────────────────────────

describe("copy não promete proximidade nem território que não existe", () => {
  it("o contexto local não diz mais 'próximos de você'", () => {
    // A contagem é por igualdade de CIDADE. Sem lat/lng (0 de 21 perfis) e sem
    // raio aplicado, "próximo" podia ser 40 km em São Paulo.
    assert.ok(
      !/próximos? de você/i.test(REPO_GROWTH),
      "voltou a prometer proximidade a partir de um filtro por cidade"
    )
  })

  it("o contexto local não chama a cidade de 'região' nem de 'área'", () => {
    // `regionId` está vazio em 100% dos perfis; emprestar a palavra dá à frase
    // a autoridade de uma camada estratégica que ali não foi consultada.
    const inicio = REPO_GROWTH.indexOf("export async function getLocalDiscoveryContext")
    const corpo = REPO_GROWTH.slice(inicio, REPO_GROWTH.indexOf("\nasync function", inicio))
    assert.ok(!/messages\.push\("Região/.test(corpo), "mensagem chama a cidade de região")
    assert.ok(!/messages\.push\("Área/.test(corpo), "mensagem chama a cidade de área")
  })

  it("o plural das mensagens é trocado, não concatenado", () => {
    // O bug real em produção: `profissional${n!==1?"is":""}` produzia
    // "profissionalis", e `confiável${n!==1?"eis":""}` produzia "confiáveleis".
    assert.ok(!REPO_GROWTH.includes('profissional${'), "voltou a concatenar sufixo de plural")
    assert.match(REPO_GROWTH, /profissionais confiáveis/)
    assert.match(REPO_GROWTH, /profissional confiável/)
  })

  it("as CTAs do painel do tutor não prometem bairro nem região", () => {
    // `/discover` filtra por cidade por padrão.
    const inicio = CTA_TUTOR.indexOf('id: "discover"')
    assert.ok(inicio > 0)
    assert.ok(!/no seu bairro/i.test(CTA_TUTOR), "CTA promete filtro por bairro")
    assert.ok(!/na sua região/i.test(CTA_TUTOR), "CTA promete camada de região")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Presença real vs camada estratégica
// ─────────────────────────────────────────────────────────────────────────────

describe("os dois tipos de verdade não se misturam no Growth", () => {
  it("presença real é contada dos PERFIS, nunca de FK territorial", () => {
    const inicio = REPO_GROWTH.indexOf("export async function getCityPresenceRows")
    const corpo = REPO_GROWTH.slice(inicio, REPO_GROWTH.indexOf("\nexport ", inicio + 10))
    assert.match(corpo, /professionalProfile\.groupBy/)
    assert.match(corpo, /tutorProfile\.groupBy/)
    assert.ok(
      !/where: \{[^}]*regionId: \{ not: null \}/.test(corpo),
      "presença real passou a depender de vínculo territorial"
    )
  })

  it("os cards do topo dizem de qual verdade cada número veio", () => {
    assert.match(PAGINA_GROWTH, /Cidades com presença real/)
    assert.match(PAGINA_GROWTH, /Bairros cadastrados/)
    assert.match(PAGINA_GROWTH, /Regiões cadastradas/)
    assert.ok(
      !/Bairros monitorados|Regiões monitoradas/.test(PAGINA_GROWTH),
      "voltou a chamar curadoria de monitoramento"
    )
  })

  it("a página explica que zero estratégico não é ausência de usuários", () => {
    assert.match(PAGINA_GROWTH, /nunca ausência de usuários/i)
  })

  it("a seção estratégica continua avisando que pode ficar zerada", () => {
    assert.match(PAGINA_GROWTH, /podem ficar zerados mesmo com presença real/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Erro não é zero — precedente do Gate 14
// ─────────────────────────────────────────────────────────────────────────────

describe("ERRO NÃO É ZERO no Growth", () => {
  it("nenhuma leitura devolve métrica zerada ao capturar exceção", () => {
    const cego = /catch\s*(\([^)]*\))?\s*\{\s*return\s*(\[\]|\{[^}]*Monitored:\s*0[\s\S]*?\})\s*\}/g
    const achados = REPO_GROWTH.match(cego) ?? []
    assert.deepEqual(achados, [], `catch devolvendo zero/vazio voltou: ${achados.join(" | ")}`)
  })

  it("nenhum catch cego sobrou no repositório de Growth", () => {
    assert.ok(!/\}\s*catch\s*\{/.test(REPO_GROWTH), "catch sem tratamento voltou")
  })

  it("o guard que PERMANECE é sobre o Prisma Client, não sobre dados", () => {
    // `hasGrowthDelegates` responde "este client foi gerado sem os modelos
    // territoriais" — condição de build, comunicada em separado pela UI.
    assert.match(REPO_GROWTH, /function hasGrowthDelegates\(\)/)
    assert.match(REPO_GROWTH, /if \(!hasGrowthDelegates\(\)\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Documentação bate com o código
// ─────────────────────────────────────────────────────────────────────────────

describe("docs de privacidade descrevem o código real", () => {
  const DOC = lerCru("docs/LOCATION_PRIVACY_POLICY.md")

  it("não afirma mais que a projeção pública inclui geo — isso é falso hoje", () => {
    assert.ok(
      !/\*\*inclui\*\* `lat`, `lng` e `serviceRadiusKm`/.test(DOC),
      "o doc voltou a descrever um risco já resolvido"
    )
  })

  it("registra que o estreitamento foi verificado", () => {
    assert.match(DOC, /RESOLVIDO \(verificado em GATE-15\)/)
    assert.match(DOC, /allowlist expl[íi]cita/i)
  })

  it("é honesto sobre serviceRadiusKm não ser null", () => {
    // A checagem em PROD mostrou 10 de 10 profissionais com o @default(10).
    assert.match(DOC, /serviceRadiusKm` \*\*não\*\* é `null`/)
  })
})
