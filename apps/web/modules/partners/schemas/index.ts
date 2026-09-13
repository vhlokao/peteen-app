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
import { brazilianPhoneRequired } from "@/lib/phone/brazilian-phone"

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

  // Obrigatório no onboarding. Regra única de telefone BR (10/11 dígitos, DDD,
  // celular com 9, DDI 55 e zero de tronco inequívocos) e saída canônica em
  // lib/phone/brazilian-phone.ts — a mesma usada por Tutor, Profissional,
  // portal e Admin (PETEEN-PHONE-WHATSAPP-INPUT-FIX-001). O servidor do
  // onboarding público valida com este MESMO schema antes de persistir.
  phone: brazilianPhoneRequired({ invalidMessage: "Informe um telefone válido com DDD" }),

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
