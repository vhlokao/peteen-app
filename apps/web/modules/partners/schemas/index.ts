/**
 * Módulo: partners
 * Camada: schemas — validação dos campos do onboarding público
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE
 *
 * O wizard público validava NADA no cliente e o servidor só checava presença
 * (`!input.businessName.trim()`). Um parceiro digitava "petshop.com" no campo
 * de logo, o valor era gravado como veio, e o resultado só aparecia depois —
 * como imagem quebrada no perfil público. O erro chegava longe de onde foi
 * cometido, que é a pior forma de errar num formulário.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTAS REGRAS NÃO SÃO NOVAS
 *
 * São as mesmas de `UpdatePartnerPortalProfileSchema`
 * (modules/partner-portal/domain/schemas.ts), que já valida EXATAMENTE estes
 * campos do MESMO Partner — só que na edição autenticada. Ter dois contratos
 * diferentes para o mesmo dado, dependendo de por qual porta ele entra, é
 * como o campo passa a aceitar uma coisa e exibir outra.
 *
 * Vivem aqui, e não em partner-portal, por direção de dependência: `partners`
 * é o módulo de baixo nível e `partner-portal` já importa dele. O caminho
 * inverso inverteria as camadas.
 *
 * DÍVIDA REGISTRADA: partner-portal ainda declara as suas próprias cópias
 * destas regras. A convergência (portal passar a importar daqui) é mecânica,
 * mas mexe num formulário autenticado que não faz parte desta missão.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESCOPO: CLIENTE, NÃO SERVIDOR
 *
 * Isto roda no wizard para dar erro no campo certo, na hora certa. NÃO foi
 * plugado nas Server Actions: apertar a validação do servidor muda o que a
 * API aceita, e isso é decisão de produto — está no relatório como achado,
 * não aplicado por conta própria.
 */

import { z } from "zod"

import { PARTNER_CATEGORIES } from "../domain/constants"
import type { PartnerCategory } from "../domain/types"

/** URL opcional — vazio é ausência, não erro. */
const urlOpcional = (rotulo: string) =>
  z
    .string()
    .trim()
    .max(500, `${rotulo} muito longo`)
    .refine((v) => v === "" || /^https?:\/\/.+/i.test(v), {
      message: `Comece com https:// para o ${rotulo.toLowerCase()} funcionar`,
    })

export const PartnerOnboardingBusinessSchema = z.object({
  category: z.enum(PARTNER_CATEGORIES as [PartnerCategory, ...PartnerCategory[]]),

  businessName: z
    .string()
    .trim()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(120, "Nome muito longo"),

  city: z.string().trim().min(2, "Cidade é obrigatória").max(100),

  state: z
    .string()
    .trim()
    .length(2, "Use a sigla do estado (ex: SP)"),

  // GATE-8-PARTNER-INPUT-MASKS-001: Partner agora tem máscara própria
  // (ver modules/partners/domain/phone-format.ts) — decisão específica deste
  // gate, que substitui a diretriz anterior de "telefone é texto livre em
  // todo o produto" só para Partner (Professional/Tutor não foram tocados).
  //
  // BUG CONFIRMADO que o `.refine` de mínimo corrige: a regex sozinha só
  // limitava a CONTAGEM DE CARACTERES da string (8-20), não a quantidade de
  // dígitos — um valor como "12345678" (8 caracteres, mas só 8 dígitos, sem
  // DDD) já passava como "válido com DDD", que é exatamente o que a mensagem
  // de erro promete verificar e a regex sozinha não garante. O piso de 10
  // alinha Partner com a mesma contagem mínima que
  // `professional-profile-form.tsx` já aplica.
  //
  // GATE-8-PARTNER-INPUT-MASKS-FIX-002: o teto de 11 foi adicionado junto —
  // `formatBrazilianPhone` agora recusa a esconder dígitos excedentes de uma
  // entrada inválida/longa (não trunca mais silenciosamente para "parecer"
  // um número válido); este teto é o que faz essa entrada ser REJEITADA em
  // vez de aceita. Um telefone BR com DDD nunca passa de 11 dígitos.
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s\-()]{8,20}$/, "Informe um telefone válido com DDD")
    .refine(
      (val) => {
        const digitos = val.replace(/\D/g, "").length
        return digitos >= 10 && digitos <= 11
      },
      { message: "Informe um telefone válido com DDD" }
    ),

  instagram: z.string().trim().max(100, "Usuário muito longo"),

  website: urlOpcional("Website"),

  logoUrl: urlOpcional("Logo"),

  description: z.string().trim().max(2000, "Descrição pode ter no máximo 2000 caracteres"),
})

export type PartnerOnboardingBusinessValues = z.infer<typeof PartnerOnboardingBusinessSchema>

/**
 * Erros por campo, prontos para o formulário.
 *
 * Só o PRIMEIRO erro de cada campo: mostrar dois avisos no mesmo input não
 * ajuda ninguém a consertar mais rápido.
 */
export function validarDadosDoNegocio(
  valores: unknown
): { ok: true } | { ok: false; erros: Record<string, string> } {
  const r = PartnerOnboardingBusinessSchema.safeParse(valores)
  if (r.success) return { ok: true }

  const erros: Record<string, string> = {}
  for (const issue of r.error.issues) {
    const campo = String(issue.path[0] ?? "")
    if (campo && !erros[campo]) erros[campo] = issue.message
  }
  return { ok: false, erros }
}
