/**
 * Módulo: partner-portal
 * Camada: domain — validação de perfil editável
 */

import { z } from "zod"
import { PARTNER_CATEGORIES } from "@/modules/partners/domain/constants"
import type { PartnerCategory } from "@/modules/partners/domain/types"
import { hasValidPartnerPhoneDigitCount } from "@/modules/partners/domain/phone-format"

const partnerCategoryEnum = z.enum(
  PARTNER_CATEGORIES as [PartnerCategory, ...PartnerCategory[]]
)

export const UpdatePartnerPortalProfileSchema = z.object({
  businessName: z
    .string()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(120, "Nome muito longo"),
  description: z
    .string()
    .max(2000, "Descrição pode ter no máximo 2000 caracteres")
    .optional(),
  city: z.string().min(2, "Cidade é obrigatória").max(100),
  state: z.string().length(2, "Use a sigla do estado (ex: SP)"),
  // GATE-8-PARTNER-INPUT-MASKS-001/FIX-002/FIX-003: mesma regra de
  // comprimento (piso 10, teto 11 dígitos) da cópia gêmea deste schema em
  // modules/partners/schemas/index.ts — ver os comentários lá para o porquê
  // de cada limite. Desde o FIX-003, a contagem de dígitos vem de
  // `hasValidPartnerPhoneDigitCount` (modules/partners/domain/phone-format.ts),
  // a mesma função que agora também protege o Admin — uma regra, três
  // consumidores. O padrão de caractere (regex abaixo) continua duplicado
  // entre os dois arquivos; dívida já registrada, fora do escopo mínimo
  // deste fix.
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{8,20}$/, "Telefone inválido")
    .refine(hasValidPartnerPhoneDigitCount, { message: "Telefone inválido — inclua o DDD" })
    .optional()
    .or(z.literal("")),
  category: partnerCategoryEnum,
  website: z
    .string()
    .url("Informe uma URL válida")
    .max(500, "URL muito longa")
    .optional()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .url("Informe uma URL válida")
    .max(500, "URL muito longa")
    .optional()
    .or(z.literal("")),
})
