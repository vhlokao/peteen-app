/**
 * Busca de profissionais por cidade — normalização e contrato de erro.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O INCIDENTE
 *
 * QA físico: Partner criado em Carapicuíba, etapa Recomendações vazia,
 * "Nenhum profissional encontrado em Carapicuíba", perfil público com 0
 * recomendados. No banco havia SEIS profissionais em Carapicuíba, todos
 * anteriores ao onboarding, e nenhum filtro de produto os excluía.
 *
 * A causa: `mode: "insensitive"` do Prisma vira `ILIKE`, que ignora CAIXA mas
 * NÃO ignora ACENTO. Medido no banco real — `ILIKE 'Carapicuíba'` devolve 6,
 * `ILIKE 'Carapicuiba'` devolve 0.
 *
 * E escrita e leitura discordavam: `createPartner` normaliza a cidade
 * (restaurando "Carapicuíba" a partir de "carapicuiba" pelo dicionário
 * KNOWN_LOCATIONS), mas a busca consultava com o texto CRU do formulário. O
 * funil de Partner é a única jornada com cidade em texto livre — Tutor e
 * Profissional usam `<select>` e só produzem grafia canônica.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTES TESTES SÃO ASSIM
 *
 * As duas funções corrigidas falam com o Prisma, então não dá para chamá-las
 * aqui sem banco. O que se garante então são as DUAS metades que de fato
 * seguram a correção:
 *
 *   1. o mecanismo — `normalizeCityName` faz as quatro grafias convergirem, e
 *      o modelo de ILIKE prova que SEM ela o caso sem acento falha;
 *   2. o contrato — as duas superfícies de busca realmente aplicam a
 *      normalização, e o `catch` silencioso não existe mais.
 *
 * A parte 2 lê o fonte de propósito: a propriedade a garantir é "este call
 * site normaliza antes de consultar", que nenhum teste unitário da função pura
 * distingue de "alguém esqueceu de chamar".
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { normalizeCityName } from "../../location/domain/normalize.ts"

const RAIZ_APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const ler = (rel: string) => readFileSync(path.join(RAIZ_APP, rel), "utf8")

const CANONICA = "Carapicuíba"

/** As quatro grafias do briefing — como um parceiro real digita no celular. */
const GRAFIAS = ["Carapicuíba", "carapicuíba", "Carapicuiba", "CARAPICUIBA"]

/**
 * Modelo de `ILIKE` sem curingas — que é exatamente o que
 * `mode: "insensitive"` do Prisma gera: compara ignorando caixa, e SÓ caixa.
 * Verificado contra o banco real antes de escrever isto.
 */
function ilike(coluna: string, termo: string): boolean {
  return coluna.toLowerCase() === termo.toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. O mecanismo
// ─────────────────────────────────────────────────────────────────────────────

describe("normalização faz as grafias convergirem", () => {
  for (const grafia of GRAFIAS) {
    it(`"${grafia}" → "${CANONICA}"`, () => {
      assert.equal(normalizeCityName(grafia), CANONICA)
    })
  }

  it("todas as quatro chegam ao MESMO valor", () => {
    const distintos = new Set(GRAFIAS.map((g) => normalizeCityName(g)))
    assert.equal(distintos.size, 1, `convergiram para ${[...distintos].join(", ")}`)
  })
})

describe("com normalização, a consulta encontra a linha do banco", () => {
  // A coluna `city` dos 10 profissionais vivos guarda a grafia canônica —
  // vieram pelo <select> de KNOWN_LOCATIONS.
  const COLUNA = CANONICA

  for (const digitado of GRAFIAS) {
    it(`digitar "${digitado}" encontra`, () => {
      const termo = normalizeCityName(digitado) ?? digitado
      assert.ok(ilike(COLUNA, termo), `"${termo}" não casou com "${COLUNA}"`)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLE NEGATIVO — a normalização precisa ser carregadora, não decorativa
// ─────────────────────────────────────────────────────────────────────────────

describe("controle negativo: SEM normalizeCityName o caso sem acento falha", () => {
  const COLUNA = CANONICA

  it("com acento passaria mesmo sem normalizar — por isso sozinho não prova nada", () => {
    assert.ok(ilike(COLUNA, "Carapicuíba"))
    assert.ok(ilike(COLUNA, "carapicuíba"))
  })

  it("SEM acento falha sem normalizar — é este o caso que a correção resolve", () => {
    // Se um dia alguém remover a normalização do call site achando que
    // `mode: "insensitive"` já cobre, ESTE é o comportamento que volta.
    assert.equal(ilike(COLUNA, "Carapicuiba"), false)
    assert.equal(ilike(COLUNA, "CARAPICUIBA"), false)
  })

  it("e passa a funcionar exatamente quando a normalização entra", () => {
    for (const semAcento of ["Carapicuiba", "CARAPICUIBA"]) {
      assert.equal(ilike(COLUNA, semAcento), false, "antes")
      assert.ok(ilike(COLUNA, normalizeCityName(semAcento)!), "depois")
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cidade canônica continua funcionando, e o resto do dicionário também
// ─────────────────────────────────────────────────────────────────────────────

describe("as demais cidades da operação não regrediram", () => {
  const casos: Array<[string, string]> = [
    ["São Paulo", "São Paulo"],
    ["sao paulo", "São Paulo"],
    ["SAO PAULO", "São Paulo"],
    ["Osasco", "Osasco"],
    ["osasco", "Osasco"],
    ["Barueri", "Barueri"],
    ["Santana de Parnaíba", "Santana de Parnaíba"],
    ["santana de parnaiba", "Santana de Parnaíba"],
  ]

  for (const [digitado, esperado] of casos) {
    it(`"${digitado}" → "${esperado}"`, () => {
      assert.equal(normalizeCityName(digitado), esperado)
    })
  }
})

describe("limite conhecido — cidade fora do dicionário", () => {
  it("recebe só capitalização segura; acento NÃO é inventado", () => {
    // Documentado como limite aceito da opção escolhida: cobrir isto exigiria
    // comparação sem acento no banco, que foi deliberadamente adiado.
    assert.equal(normalizeCityName("sao roque"), "Sao Roque")
    assert.notEqual(normalizeCityName("sao roque"), "São Roque")
  })

  it("o filtro nunca some quando a cidade é desconhecida", () => {
    // O call site usa `normalizeCityName(x) ?? x`. Se a normalização virasse
    // null, cair para o texto original mantém o filtro; perdê-lo devolveria
    // profissionais de todo lugar sem ninguém ter pedido.
    const desconhecida = "Cidade Que Não Existe"
    assert.ok((normalizeCityName(desconhecida) ?? desconhecida).length > 0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. O contrato dos call sites
// ─────────────────────────────────────────────────────────────────────────────

const REPO_PARTNERS = ler("modules/partners/infrastructure/repository.ts")
const QUERIES_PORTAL = ler("modules/partner-portal/infrastructure/queries.ts")
const ACTIONS_ONBOARDING = ler("modules/partners/application/onboarding-actions.ts")
const CONSTANTS_PARTNERS = ler("modules/partners/domain/constants.ts")

/** Corpo de uma função exportada, até a linha que fecha na coluna 0. */
function corpoDe(fonte: string, nome: string): string {
  const linhas = fonte.split("\n")
  const inicio = linhas.findIndex((l) => l.includes(`export async function ${nome}`))
  assert.notEqual(inicio, -1, `função ${nome} não encontrada`)
  const corpo: string[] = []
  for (let j = inicio; j < linhas.length; j++) {
    corpo.push(linhas[j]!)
    // `.trimEnd()` obrigatório: o repositório usa CRLF, então a linha de
    // fechamento é `"}\r"`.
    if (j > inicio && linhas[j]!.trimEnd() === "}") break
  }
  return corpo.join("\n")
}

describe("onboarding e portal usam a MESMA normalização", () => {
  it("getProfessionalsForOnboarding normaliza antes de consultar", () => {
    const corpo = corpoDe(REPO_PARTNERS, "getProfessionalsForOnboarding")
    assert.match(corpo, /normalizeCityName\(/)
    // A normalização tem que acontecer ANTES do findMany, senão é enfeite.
    assert.ok(
      corpo.indexOf("normalizeCityName(") < corpo.indexOf("findMany"),
      "normalizeCityName precisa vir antes do findMany"
    )
  })

  it("searchProfessionalsForPartnerRecommendation normaliza antes de consultar", () => {
    const corpo = corpoDe(QUERIES_PORTAL, "searchProfessionalsForPartnerRecommendation")
    assert.match(corpo, /normalizeCityName\(/)
    assert.ok(
      corpo.indexOf("normalizeCityName(") < corpo.indexOf("findMany"),
      "normalizeCityName precisa vir antes do findMany"
    )
  })

  it("nenhuma das duas passa o texto CRU do formulário para o filtro de cidade", () => {
    // A regressão exata: voltar a filtrar por `city.trim()` sem normalizar.
    for (const [nome, corpo] of [
      ["onboarding", corpoDe(REPO_PARTNERS, "getProfessionalsForOnboarding")],
      ["portal", corpoDe(QUERIES_PORTAL, "searchProfessionalsForPartnerRecommendation")],
    ] as const) {
      assert.doesNotMatch(
        corpo,
        /city:\s*\{\s*equals:\s*\w*[Cc]ity(Bruta)?\.trim\(\)/,
        `${nome} voltou a filtrar pelo texto cru`
      )
    }
  })

  it("as duas importam do MESMO módulo — não há duas normalizações", () => {
    for (const fonte of [REPO_PARTNERS, QUERIES_PORTAL]) {
      assert.match(fonte, /import \{[^}]*normalizeCityName[^}]*\} from "@\/modules\/location"/)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Erro ≠ lista vazia
// ─────────────────────────────────────────────────────────────────────────────

describe("falha de busca deixou de se disfarçar de lista vazia", () => {
  it("o repository não engole mais o erro", () => {
    const corpo = corpoDe(REPO_PARTNERS, "getProfessionalsForOnboarding")
    // Era `catch { return [] }`: um timeout de banco virava "sua cidade não
    // tem profissionais", afirmando algo que ninguém chegou a verificar.
    assert.doesNotMatch(corpo, /catch\s*(\([^)]*\))?\s*\{[\s\S]*return\s*\[\]/)
  })

  it("a action devolve ActionResult, não um array cru", () => {
    // Array não sabe dizer "falhou" — é a forma do retorno que separa os casos.
    assert.match(
      ACTIONS_ONBOARDING,
      /getProfessionalsForOnboardingAction\([\s\S]{0,80}\): Promise<ActionResult<ProfessionalOnboardingOption\[\]>>/
    )
  })

  it("a action trata o erro e devolve mensagem humana, sem detalhe técnico", () => {
    const corpo = corpoDe(ACTIONS_ONBOARDING, "getProfessionalsForOnboardingAction")
    assert.match(corpo, /ok: true, data/)
    assert.match(corpo, /ok: false, error: BUSCA_PROFISSIONAIS_INDISPONIVEL/)
    assert.match(corpo, /console\.error/, "o detalhe real precisa ir para o log do servidor")
  })

  it("a constante NÃO vive no arquivo \"use server\" — lá todo export tem de ser async", () => {
    // Regressão de build, não de tipo: `tsc` e o lint passam com a constante
    // exportada de um arquivo "use server"; só `next build` reprova.
    assert.doesNotMatch(ACTIONS_ONBOARDING, /export const BUSCA_PROFISSIONAIS_INDISPONIVEL/)
    assert.match(CONSTANTS_PARTNERS, /export const BUSCA_PROFISSIONAIS_INDISPONIVEL/)
  })

  it("a mensagem ao parceiro não vaza camada nem stack", () => {
    const msg = CONSTANTS_PARTNERS.match(
      /BUSCA_PROFISSIONAIS_INDISPONIVEL\s*=\s*\n?\s*"([^"]+)"/
    )?.[1]
    assert.ok(msg, "constante de mensagem não encontrada")
    for (const proibido of ["prisma", "SQL", "timeout", "Error", "banco", "pooler"]) {
      assert.ok(
        !msg.toLowerCase().includes(proibido.toLowerCase()),
        `mensagem expõe "${proibido}"`
      )
    }
  })

  it("a UI separa os três estados — carregando, erro, vazio", () => {
    const wizard = ler("modules/partners/components/PartnerOnboardingWizard.tsx")
    // O erro tem que ter ramo PRÓPRIO, e antes do vazio: se cair no mesmo
    // ramo, o parceiro volta a ler "Nenhum profissional encontrado" para uma
    // falha de rede.
    assert.match(wizard, /erroBusca \?/)
    assert.ok(
      wizard.indexOf("erroBusca ?") < wizard.indexOf("professionals.length === 0"),
      "o ramo de erro precisa ser avaliado antes do de lista vazia"
    )
    assert.match(wizard, /Tentar de novo/)
  })
})
