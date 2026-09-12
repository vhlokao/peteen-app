/**
 * SA-001 (Superaudit pré-piloto) — testes de fiação (wiring).
 *
 * As funções corrigidas por esta missão (`completePartnerOnboarding`,
 * `savePartnerOnboardingRecommendationsAction`,
 * `getActiveConnectionsForProfessional`/`getActiveConnectionsBatch`,
 * `getPartnerEndorsementsForProfessional`/`Batch`) importam `@/lib/prisma/
 * client` (direto ou transitivamente) e por isso não podem ser executadas
 * sob `node --test` sem `DATABASE_URL` configurada — mesma limitação já
 * documentada nos demais módulos deste repositório (não existe hoje
 * nenhum teste de `infrastructure/repository.ts` ou de Server Action que
 * toque Prisma rodando na suíte rápida).
 *
 * Em vez de mockar Prisma (não há harness disso neste projeto), este
 * arquivo prova por LEITURA DE FONTE — mesmo padrão já usado em
 * `legal-documents.test.ts` — que:
 *   1. o onboarding público não volta a gravar `isActive: true`;
 *   2. o caminho público de recomendações usa o MESMO teto do portal
 *      autenticado (não fica mais fraco);
 *   3. as duas leituras de trust-graph e as duas de endossos do parceiro
 *      consomem o filtro de elegibilidade centralizado (não reimplementam
 *      a condição inline, o que poderia divergir silenciosamente);
 *   4. a tela de sucesso do onboarding não afirma incondicionalmente que o
 *      parceiro "está ativo".
 *
 * A correção comportamental em si (o quê `partnerIsTrustEligible`/
 * `PARTNER_TRUST_ELIGIBLE_WHERE`/`ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS`
 * decidem) está travada por execução real em `trust-eligibility.test.ts` e
 * `partner-eligibility-filter.test.ts`. Este arquivo prova que essas
 * decisões estão de fato LIGADAS aos pontos de escrita/leitura corretos.
 *
 * Rodar: node --experimental-strip-types --test modules/partners/domain/sa001-partner-trust-wiring.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..") // modules/partners/domain -> apps/web
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8")

/**
 * Extrai o corpo de UMA função exportada, do `export async function <nome>`
 * até a próxima declaração de topo (`\nexport `) ou o fim do arquivo — para
 * as asserções abaixo não vazarem para funções vizinhas do mesmo arquivo
 * (ex.: `createPartner`, do admin, que legitimamente grava `isActive: true`
 * e não deve fazer este teste passar por acidente).
 */
function extrairFuncao(fonte: string, nome: string): string {
  const marcador = `export async function ${nome}(`
  const inicio = fonte.indexOf(marcador)
  assert.ok(inicio >= 0, `função "${nome}" não encontrada`)
  const resto = fonte.slice(inicio + marcador.length)
  const proximoExport = resto.search(/\nexport (async function|function|const)/)
  return proximoExport >= 0 ? resto.slice(0, proximoExport) : resto
}

describe("SA-001 — onboarding público não autoativa parceiro", () => {
  it("completePartnerOnboarding não grava isActive: true", () => {
    const corpo = extrairFuncao(
      ler("modules/partners/infrastructure/repository.ts"),
      "completePartnerOnboarding"
    )
    assert.ok(
      !/isActive\s*:\s*true/.test(corpo),
      "completePartnerOnboarding voltou a autoativar o parceiro na conclusão do onboarding"
    )
    // Continua avançando o status/timestamp de onboarding — não é regressão
    // de funcionalidade, só da autoativação.
    assert.match(corpo, /onboardingStatus\s*:\s*["']COMPLETED["']/)
    assert.match(corpo, /onboardingCompletedAt/)
  })

  it("createPartner (admin) continua podendo ativar — este teste não bloqueou o caminho administrativo", () => {
    // Controle negativo: prova que o teste acima é específico da função
    // certa, não uma checagem cega em todo o arquivo.
    const corpo = extrairFuncao(
      ler("modules/partners/infrastructure/repository.ts"),
      "createPartner"
    )
    assert.match(corpo, /isActive\s*:\s*true/)
  })

  it("tela de sucesso do onboarding não afirma incondicionalmente 'está ativo'", () => {
    const fonte = ler("modules/partners/components/PartnerOnboardingWizard.tsx")
    assert.match(
      fonte,
      /result\.partner\.isActive\s*\?/,
      "a tela de sucesso precisa decidir a frase pelo isActive real do parceiro"
    )
  })
})

describe("SA-001 — teto do caminho público de recomendações não fica mais fraco que o autenticado", () => {
  it("savePartnerOnboardingRecommendationsAction usa o MESMO teto (MAX_ACTIVE_PARTNER_ENDORSEMENTS_MVP) do portal autenticado", () => {
    const fonte = ler("modules/partners/application/onboarding-actions.ts")
    const corpo = extrairFuncao(fonte, "savePartnerOnboardingRecommendationsAction")
    assert.match(
      corpo,
      /ANTIFRAUD_GUARDRAILS\.MAX_ACTIVE_PARTNER_ENDORSEMENTS_MVP/,
      "caminho público não consulta o teto de endossos ativos"
    )
    assert.match(
      corpo,
      /countActiveConnectionsBySource/,
      "caminho público não conta os endossos já ativos antes de criar mais"
    )
  })

  it("o portal autenticado (recommendation-actions.ts) usa a MESMA constante — nenhum dos dois hardcoda um número próprio", () => {
    const fonte = ler("modules/partner-portal/application/recommendation-actions.ts")
    assert.match(fonte, /ANTIFRAUD_GUARDRAILS\.MAX_ACTIVE_PARTNER_ENDORSEMENTS_MVP/)
  })
})

describe("SA-001 — leituras que produzem efeito de confiança consomem o filtro centralizado", () => {
  it("getActiveConnectionsForProfessional e getActiveConnectionsBatch usam ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS", () => {
    const fonte = ler("modules/trust-graph/infrastructure/repository.ts")
    assert.match(
      fonte,
      /import\s*{\s*ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS\s*}\s*from\s*["']\.\.\/domain\/partner-eligibility-filter["']/,
      "repository não importa o filtro centralizado — pode ter voltado a reimplementar a condição inline"
    )
    const corpoIndividual = extrairFuncao(fonte, "getActiveConnectionsForProfessional")
    const corpoBatch = extrairFuncao(fonte, "getActiveConnectionsBatch")
    for (const [nome, corpo] of [
      ["getActiveConnectionsForProfessional", corpoIndividual],
      ["getActiveConnectionsBatch", corpoBatch],
    ] as const) {
      assert.match(
        corpo,
        /\.\.\.ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS/,
        `${nome} não aplica o filtro de elegibilidade de parceiro`
      )
    }
  })

  it("getPartnerEndorsementsForProfessional e getPartnerEndorsementsBatch usam PARTNER_TRUST_ELIGIBLE_WHERE", () => {
    const fonte = ler("modules/partners/application/get-partner-endorsements.ts")
    assert.match(
      fonte,
      /import\s*{\s*PARTNER_TRUST_ELIGIBLE_WHERE\s*}\s*from\s*["']\.\.\/domain\/trust-eligibility["']/,
      "consulta não importa o critério canônico de elegibilidade"
    )
    const corpoIndividual = extrairFuncao(fonte, "getPartnerEndorsementsForProfessional")
    const corpoBatch = extrairFuncao(fonte, "getPartnerEndorsementsBatch")
    for (const [nome, corpo] of [
      ["getPartnerEndorsementsForProfessional", corpoIndividual],
      ["getPartnerEndorsementsBatch", corpoBatch],
    ] as const) {
      assert.match(
        corpo,
        /sourcePartner\s*:\s*PARTNER_TRUST_ELIGIBLE_WHERE/,
        `${nome} não filtra por PARTNER_TRUST_ELIGIBLE_WHERE`
      )
    }
  })
})
