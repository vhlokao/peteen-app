/**
 * PETEEN-PHONE-WHATSAPP-INPUT-FIX-001 — contrato das superfícies de telefone.
 *
 * Teste de FONTE (não de runtime): formulários são Client Components e as
 * actions são "use server", nenhum dos dois roda em `node --test`. O que se
 * trava aqui é a FIAÇÃO — toda superfície passa pela fonte única
 * lib/phone/brazilian-phone.ts e nenhuma regra de telefone volta a existir
 * solta em outro arquivo.
 *
 * Rodar: npm run test:phone
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ_APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const ler = (rel: string) => readFileSync(path.join(RAIZ_APP, rel), "utf8")
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "")

const FONTE_UNICA = /from "(@\/lib\/phone\/brazilian-phone|@\/modules\/partners\/domain\/phone-format)"/

/** As 7 superfícies de ENTRADA de telefone do produto. */
const SUPERFICIES = [
  { nome: "Onboarding Tutor", arquivo: "modules/tutor/components/tutor-profile-form.tsx", edicao: false, autofill: true },
  { nome: "Edição Tutor", arquivo: "modules/tutor/components/tutor-profile-edit-form.tsx", edicao: true, autofill: true },
  { nome: "Onboarding Profissional", arquivo: "modules/professional/components/professional-profile-form.tsx", edicao: false, autofill: true },
  { nome: "Edição Profissional", arquivo: "modules/professional/components/professional-profile-edit-form.tsx", edicao: true, autofill: true },
  { nome: "Onboarding Parceiro", arquivo: "modules/partners/components/PartnerOnboardingWizard.tsx", edicao: false, autofill: true },
  { nome: "Portal Parceiro", arquivo: "modules/partner-portal/components/partner-profile-edit-form.tsx", edicao: true, autofill: true },
  // Admin digita o telefone DE OUTRO negócio: autofill do navegador sugeriria
  // o do próprio admin. Mantém type/inputMode tel, sem autoComplete=tel.
  { nome: "Admin Parceiro", arquivo: "components/admin/PartnerForm.tsx", edicao: true, autofill: false },
] as const

describe("as 7 superfícies de entrada usam a máscara da fonte única", () => {
  for (const s of SUPERFICIES) {
    const fonte = semComentarios(ler(s.arquivo))

    it(`${s.nome}: importa da fonte única e aplica formatBrazilianPhone no onChange`, () => {
      assert.match(fonte, FONTE_UNICA)
      assert.match(fonte, /formatBrazilianPhone\(e\.target\.value\)/)
    })

    it(`${s.nome}: type="tel" e inputMode="tel"${s.autofill ? ' e autoComplete="tel"' : ""}`, () => {
      assert.match(fonte, /type="tel"/)
      assert.match(fonte, /inputMode="tel"/)
      if (s.autofill) assert.match(fonte, /autoComplete="tel"/)
    })

    it(`${s.nome}: placeholder no formato da máscara, sem sugerir +55`, () => {
      assert.match(fonte, /placeholder="\(11\) 99999-9999"/)
      assert.doesNotMatch(fonte, /placeholder="\+55/)
    })

    if (s.edicao) {
      it(`${s.nome}: valor gravado abre por phoneInputInitialValue (inválido fica bruto)`, () => {
        assert.match(fonte, /phoneInputInitialValue\(/)
        assert.doesNotMatch(fonte, /formatBrazilianPhone\([^)]*phone \?\? ""\)/)
      })
    }
  }
})

describe("schemas de servidor e cliente usam os helpers da fonte única", () => {
  const casos: Array<[string, RegExp]> = [
    ["modules/tutor/domain/types.ts", /phone:\s*brazilianPhoneOptional\(/],
    ["modules/professional/domain/types.ts", /phone:\s*brazilianPhoneOptional\(/],
    ["modules/partners/schemas/index.ts", /phone:\s*brazilianPhoneRequired\(/],
    ["modules/partner-portal/domain/schemas.ts", /phone:\s*brazilianPhoneOptional\(/],
    ["modules/professional/components/professional-profile-form.tsx", /phone:\s*brazilianPhoneRequired\(/],
    ["modules/professional/components/professional-profile-edit-form.tsx", /phone:\s*brazilianPhoneRequired\(/],
  ]
  for (const [arquivo, re] of casos) {
    it(arquivo, () => assert.match(semComentarios(ler(arquivo)), re))
  }

  it("obrigatoriedade preservada: Tutor e Profissional OPCIONAIS no servidor", () => {
    for (const arquivo of ["modules/tutor/domain/types.ts", "modules/professional/domain/types.ts"]) {
      assert.doesNotMatch(semComentarios(ler(arquivo)), /phone:\s*brazilianPhoneRequired\(/, arquivo)
    }
  })

  it("Profissional: botão travado pela MESMA regra (isValidBrazilianPhone), nas duas telas", () => {
    for (const arquivo of [
      "modules/professional/components/professional-profile-form.tsx",
      "modules/professional/components/professional-profile-edit-form.tsx",
    ]) {
      assert.match(semComentarios(ler(arquivo)), /const isPhoneValid = isValidBrazilianPhone\(watch\("phone"\)\)/, arquivo)
    }
  })
})

describe("nenhuma regra de telefone solta fora de lib/phone", () => {
  const arquivos: string[] = []
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      if (nome === "node_modules" || nome.startsWith(".")) continue
      const p = path.join(dir, nome)
      if (statSync(p).isDirectory()) andar(p)
      else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) arquivos.push(path.relative(RAIZ_APP, p).replace(/\\/g, "/"))
    }
  }
  for (const raiz of ["app", "components", "modules", "lib"]) andar(path.join(RAIZ_APP, raiz))
  const fora = arquivos.filter((a) => !a.startsWith("lib/phone/"))

  const PROIBIDOS: Array<[string, RegExp]> = [
    ["regex de caractere de telefone", /\[\\d\\s\\-\(\)\]/],
    ["contagem de dígitos solta", /replace\(\/\\D\/g,\s*""\)\.length/],
    ["link wa.me montado à mão", /wa\.me\//],
    ["buildWhatsAppUrl", /buildWhatsAppUrl/],
  ]

  it("a varredura encontrou os arquivos (sanidade)", () => {
    assert.ok(fora.length > 100)
    assert.ok(fora.includes("app/(tutor)/tutor/requests/[requestId]/page.tsx"))
  })

  for (const [rotulo, re] of PROIBIDOS) {
    it(`sem ${rotulo}`, () => {
      const achados = fora.filter((a) => re.test(semComentarios(ler(a))))
      assert.deepEqual(achados, [])
    })
  }

  it("modules/partners/domain/phone-format.ts é só re-export (sem regra própria)", () => {
    const fonte = semComentarios(ler("modules/partners/domain/phone-format.ts"))
    assert.match(fonte, /from "\.\.\/\.\.\/\.\.\/lib\/phone\/brazilian-phone\.ts"/)
    assert.doesNotMatch(fonte, /\.startsWith\(|\.slice\(|RegExp|\/\^/)
  })
})

describe("WhatsApp e exibição", () => {
  it("detalhe da solicitação: link só por toWhatsAppUrl; sem link quando null", () => {
    const fonte = semComentarios(ler("app/(tutor)/tutor/requests/[requestId]/page.tsx"))
    assert.match(fonte, /const whatsAppUrl = isAccepted \? toWhatsAppUrl\(professionalPhone\) : null/)
    assert.match(fonte, /\{whatsAppUrl \? \(/)
    assert.match(fonte, /href=\{whatsAppUrl\}/)
    assert.match(fonte, /O contato direto é liberado quando a solicitação for aceita\./, "estado neutro existente")
  })

  it("página pública do Parceiro exibe só telefone válido, formatado", () => {
    const fonte = semComentarios(ler("app/(marketing)/partners/[slug]/page.tsx"))
    assert.match(fonte, /const publicPhone = formatStoredBrazilianPhone\(partner\.phone\)/)
    assert.doesNotMatch(fonte, /\{partner\.phone\}/)
  })

  it("resumo da edição do Profissional não exibe o valor cru como contato", () => {
    const fonte = semComentarios(ler("modules/professional/components/professional-profile-edit-form.tsx"))
    assert.match(fonte, /formatStoredBrazilianPhone\(profile\.phone\)/)
    assert.doesNotMatch(fonte, /\{profile\.phone \|\| "—"\}/)
  })
})

describe("persistência canônica e validação ANTES do repository", () => {
  /** Corpo de uma função exportada: do `export` até o próximo `export`. */
  function corpo(arquivo: string, nome: string): string {
    const fonte = semComentarios(ler(arquivo))
    const i = fonte.search(new RegExp(`export async function ${nome}\\b`))
    assert.ok(i >= 0, `${nome} não encontrada`)
    const resto = fonte.slice(i + 1)
    const j = resto.search(/\nexport /)
    return fonte.slice(i, j === -1 ? undefined : i + 1 + j)
  }

  const ONB = "modules/partners/application/onboarding-actions.ts"

  it("onboarding público — create: valida telefone antes de createPartnerOnboarding e grava o canônico", () => {
    const c = corpo(ONB, "savePartnerOnboardingBusinessAction")
    const iValida = c.indexOf("telefoneDoOnboarding(input.phone)")
    const iRepo = c.indexOf("await createPartnerOnboarding(")
    assert.ok(iValida >= 0 && iRepo > iValida)
    assert.match(c, /if \(!telefone\.ok\) return \{ ok: false, error: telefone\.error \}/)
    assert.match(c, /createPartnerOnboarding\(\{ \.\.\.input, phone: telefone\.phone \}\)/)
  })

  it("onboarding público — update: sessão, depois telefone, depois repository", () => {
    const c = corpo(ONB, "updatePartnerOnboardingBusinessAction")
    const iSessao = c.indexOf("lerSessaoOnboarding()")
    const iValida = c.indexOf("telefoneDoOnboarding(input.phone)")
    const iRepo = c.indexOf("await updatePartnerOnboardingBusiness(")
    assert.ok(iSessao >= 0 && iValida > iSessao && iRepo > iValida)
    assert.match(c, /updatePartnerOnboardingBusiness\(sessao\.partnerId, \{ \.\.\.input, phone: telefone\.phone \}\)/)
  })

  it("onboarding público usa o schema obrigatório da fonte única", () => {
    assert.match(semComentarios(ler(ONB)), /const TELEFONE_ONBOARDING = brazilianPhoneRequired\(/)
  })

  it("Admin grava o telefone canônico depois de validar", () => {
    const ADM = "modules/partners/application/actions.ts"
    assert.match(corpo(ADM, "createPartnerAction"), /await createPartner\(withCanonicalPhone\(input\)\)/)
    assert.match(corpo(ADM, "updatePartnerAction"), /await updatePartner\(id, withCanonicalPhone\(input\)\)/)
  })

  it("Tutor/Profissional/Portal: repositories continuam recebendo parsed.data.phone (já canônico pelo schema)", () => {
    assert.match(ler("modules/tutor/application/actions.ts"), /phone: parsed\.data\.phone \|\| null/)
    assert.match(ler("modules/professional/application/actions.ts"), /phone: parsed\.data\.phone \|\| null/)
    assert.match(ler("modules/partner-portal/application/actions.ts"), /phone: parsed\.data\.phone/)
  })
})
