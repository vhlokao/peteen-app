/**
 * Regressão de R2B.1 (gate de QA independente): prova que o CTA "Avaliar
 * atendimento" e o alvo do formulário de avaliação nunca podem divergir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE TESTE É NO NÍVEL DE FONTE, NÃO DE RENDER
 *
 * `TutorRequestNextStep.tsx` e a página de detalhe são componentes React/TSX —
 * `node --test` (o runner deste projeto) não tem transform de JSX, então
 * importá-los diretamente não é viável sem trazer um bundler para dentro do
 * conjunto de testes puros. Em vez disso, este teste lê os DOIS arquivos como
 * texto e verifica a propriedade que importa: os dois lados referenciam o
 * MESMO IDENTIFICADOR `REVIEW_SECTION_ID`, nunca uma string literal solta.
 *
 * Isso é deliberadamente mais forte do que testar só o valor da constante.
 * O bug que este teste existe para impedir não é "o valor mudou" — é "um dos
 * dois lados passou a usar um literal em vez do identificador importado",
 * que é exatamente o tipo de edição que um autofix de editor ou um merge
 * descuidado produz sem ninguém perceber: o TypeScript não acusa (ambos são
 * `string`), o app builda, e o link só se prova quebrado quando alguém clica.
 *
 * Roda: npm run test:tutor-portal
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const AQUI = path.dirname(fileURLToPath(import.meta.url))

const NEXT_STEP_PATH = path.join(AQUI, "TutorRequestNextStep.tsx")
const PAGE_PATH = path.join(
  AQUI,
  "../../../app/(tutor)/tutor/requests/[requestId]/page.tsx"
)

const nextStepSource = readFileSync(NEXT_STEP_PATH, "utf8")
const pageSource = readFileSync(PAGE_PATH, "utf8")

describe("REVIEW_SECTION_ID — CTA e âncora nunca podem divergir", () => {
  it("TutorRequestNextStep.tsx exporta REVIEW_SECTION_ID como constante de string não vazia", () => {
    const match = nextStepSource.match(
      /export const REVIEW_SECTION_ID = "([^"]+)"/
    )
    assert.ok(match, "REVIEW_SECTION_ID precisa ser exportado como string literal")
    assert.ok((match?.[1]?.length ?? 0) > 0, "REVIEW_SECTION_ID não pode ser vazio")
  })

  it("o CTA de avaliação usa o IDENTIFICADOR REVIEW_SECTION_ID no href, não uma string solta", () => {
    // Precisa ser exatamente href={`#${REVIEW_SECTION_ID}`} — um literal como
    // href="#avaliar-atendimento" passaria despercebido no TypeScript (mesmo
    // tipo) e é exatamente a divergência que este teste existe para pegar.
    assert.match(
      nextStepSource,
      /href=\{`#\$\{REVIEW_SECTION_ID\}`\}/,
      "o CTA \"Avaliar atendimento\" precisa apontar para `#${REVIEW_SECTION_ID}`, referenciando o identificador"
    )
  })

  it("a página de detalhe do tutor IMPORTA REVIEW_SECTION_ID do módulo correto", () => {
    assert.match(
      pageSource,
      /import\s*\{[^}]*\bREVIEW_SECTION_ID\b[^}]*\}\s*from\s*"@\/modules\/tutor-portal\/components\/TutorRequestNextStep"/,
      "a página precisa importar REVIEW_SECTION_ID de TutorRequestNextStep — sem isso o id da seção não pode estar sincronizado"
    )
  })

  it("a seção do ReviewForm usa o IDENTIFICADOR REVIEW_SECTION_ID como id, não uma string solta", () => {
    assert.match(
      pageSource,
      /id=\{REVIEW_SECTION_ID\}/,
      "a seção que envolve o ReviewForm precisa usar id={REVIEW_SECTION_ID}, referenciando o identificador"
    )
  })

  it("nenhum dos dois arquivos tem um literal 'avaliar-atendimento' competindo com o identificador", () => {
    // A ÚNICA ocorrência literal permitida da string é a própria definição da
    // constante, em TutorRequestNextStep.tsx. Qualquer outra ocorrência
    // literal — em qualquer um dos dois arquivos — é um id duplicado em
    // potencial: dois elementos disputando o mesmo `#avaliar-atendimento`, ou
    // um CTA e uma âncora fisicamente escritos por mãos diferentes que hoje
    // batem por coincidência e amanhã não batem mais.
    const ocorrenciasNoNextStep = [
      ...nextStepSource.matchAll(/"avaliar-atendimento"/g),
    ].length
    assert.equal(
      ocorrenciasNoNextStep,
      1,
      "'avaliar-atendimento' como literal só pode aparecer uma vez em TutorRequestNextStep.tsx: na definição de REVIEW_SECTION_ID"
    )

    const ocorrenciasNaPagina = [
      ...pageSource.matchAll(/avaliar-atendimento/g),
    ].length
    assert.equal(
      ocorrenciasNaPagina,
      0,
      "a página de detalhe não pode conter o literal 'avaliar-atendimento' — ela deve usar somente o identificador importado REVIEW_SECTION_ID"
    )
  })
})
