/**
 * Módulo: professional
 * Camada: domain
 *
 * Regra absoluta: sem imports de Prisma, Supabase ou frameworks.
 * Código TypeScript puro — portável e testável de forma isolada.
 *
 * Contém:
 *   - Enums de domínio (ServiceType, TrustLevel, PlanType)
 *   - Tipos de domínio puros (ProfessionalProfileData, ServiceData)
 *   - Schemas Zod de validação de input
 *   - Contratos de conexão com sistemas futuros (Trust Score, Ranking)
 */

import { z } from "zod"
import type { ActionResult } from "@/modules/tutor/domain/types"

// Re-exporta ActionResult para que o módulo não dependa do tutor
export type { ActionResult }

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS DE DOMÍNIO
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICE_TYPES = [
  "DOG_WALK",
  "PET_SITTING",
  "BOARDING",
  "GROOMING",
  "TRAINING",
  "VET_ACCOMPANY",
  "DAY_CARE",
  "HOME_CARE",
  "OTHER",
] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  DOG_WALK: "Passeio",
  PET_SITTING: "Pet Sitter",
  BOARDING: "Hospedagem",
  GROOMING: "Banho e Tosa",
  TRAINING: "Adestramento",
  VET_ACCOMPANY: "Acompanhamento Veterinário",
  DAY_CARE: "Day Care",
  HOME_CARE: "Cuidado em Casa",
  OTHER: "Outro",
}

export const TRUST_LEVELS = [
  "INITIAL",
  "BUILDING",
  "ESTABLISHED",
  "TRUSTED",
  "ELITE",
] as const
export type TrustLevel = (typeof TRUST_LEVELS)[number]

/**
 * Rótulo humano de cada faixa do Índice de Confiança.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTES NOMES E NÃO OS ANTERIORES
 *
 * A escada anterior era "Novo → Confiável → Verificado → Destaque → Elite", e
 * tinha três defeitos que a auditoria pré-piloto mediu:
 *
 *   1. "Verificado" (faixa 41–60) AFIRMAVA UMA VERIFICAÇÃO QUE NÃO EXISTE.
 *      Verificação é um fato próprio no produto (`verifiedIdentity`,
 *      VerificationRequest com aprovação de admin, badge `verified` em
 *      reputation-badges). Um profissional com 41 pontos e ZERO verificação
 *      exibia "Verificado" — e podia exibir isso ao lado da ausência do badge
 *      real de verificação, na mesma tela. Reputação é o ativo do produto;
 *      um selo que mente sobre um fato verificável é o pior defeito possível.
 *
 *   2. "Destaque" (faixa 61–80) lê como posição paga/patrocinada. O Ranking
 *      não considera plano nem pagamento (ver modules/ranking/domain/scoring),
 *      mas o rótulo sugeria o contrário — exatamente o que a marca não pode
 *      insinuar.
 *
 *   3. A ordem não era monotônica em significado: nada em "Verificado" soa
 *      mais alto que "Confiável", nem "Destaque" mais que "Verificado". O
 *      tutor não conseguia ordenar dois profissionais pelos rótulos.
 *
 * A escada nova é uma progressão legível de uma coisa só — confiança — e não
 * reivindica nenhum fato externo:
 *
 *   Novo → Confiança em evolução → Confiança consistente → Alta confiança
 *        → Confiança excepcional
 *
 * NENHUM threshold, peso ou fórmula mudou. Ver TRUST_LEVEL_THRESHOLDS em
 * modules/trust-engine/domain/constants.ts — as faixas são as mesmas.
 */
export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  INITIAL:     "Novo",
  BUILDING:    "Confiança em evolução",
  ESTABLISHED: "Confiança consistente",
  TRUSTED:     "Alta confiança",
  ELITE:       "Confiança excepcional",
}

export const PLAN_TYPES = ["FREE", "PROFESSIONAL", "PROFESSIONAL_PLUS"] as const
export type PlanType = (typeof PLAN_TYPES)[number]

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS DE VALIDAÇÃO — ProfessionalProfile
// ─────────────────────────────────────────────────────────────────────────────

export const CreateProfessionalProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(100, "Nome muito longo"),
  bio: z
    .string()
    .min(50, "A apresentação deve ter ao menos 50 caracteres")
    .max(1000, "Bio pode ter no máximo 1000 caracteres"),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{8,20}$/, "Telefone inválido")
    .optional()
    .or(z.literal("")),
  neighborhood: z.string().max(100).optional(),
  city: z.string().min(2, "Cidade é obrigatória").max(100),
  state: z
    .string()
    .length(2, "Use a sigla do estado (ex: SP)")
    .toUpperCase(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  avatarUrl: z
    .string()
    .url("Informe uma URL válida")
    .max(500, "URL muito longa")
    .optional()
    .or(z.literal("")),
  serviceRadiusKm: z
    .number()
    .min(1, "Raio mínimo de 1 km")
    .max(200, "Raio máximo de 200 km")
    .optional(),
  serviceTypes: z
    .array(z.enum(SERVICE_TYPES))
    .min(1, "Selecione ao menos um tipo de serviço")
    .max(9, "Máximo de 9 tipos de serviço"),
  specializations: z
    .array(z.string().max(50))
    .max(20, "Máximo de 20 especializações")
    .default([]),
})

export type CreateProfessionalProfileInput = z.infer<
  typeof CreateProfessionalProfileSchema
>

export const UpdateProfessionalProfileSchema =
  CreateProfessionalProfileSchema.partial()
export type UpdateProfessionalProfileInput = z.infer<
  typeof UpdateProfessionalProfileSchema
>

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS DE VALIDAÇÃO — Service (catálogo de serviços)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Limites da duração padrão (Agenda Foundation V0.3).
 *
 * São limites TÉCNICOS/defensivos, não regra antifraude:
 *   - mínimo evita 0 e valores sem sentido operacional;
 *   - máximo cobre um dia inteiro; serviços de vários dias (hospedagem) não
 *     são representáveis nesta etapa e ficam para a V1.
 * Nenhum deles é usado para julgar duração REAL de atendimento.
 */
export const SERVICE_DURATION_LIMITS = {
  MIN_MINUTES: 5,
  MAX_MINUTES: 1440,
} as const

/**
 * Sugestões de duração por tipo de serviço — APENAS UX (preenchimento
 * assistido do formulário). Nunca são gravadas automaticamente: se o
 * profissional não informar duração, o serviço fica sem duração.
 */
export const SERVICE_DURATION_SUGGESTIONS: Partial<Record<ServiceType, number>> = {
  DOG_WALK: 45,
  PET_SITTING: 60,
  GROOMING: 90,
  TRAINING: 60,
  VET_ACCOMPANY: 120,
  DAY_CARE: 480,
  HOME_CARE: 60,
}

export const CreateServiceSchema = z
  .object({
    name: z
      .string()
      .min(2, "Nome do serviço deve ter ao menos 2 caracteres")
      .max(100, "Nome muito longo"),
    description: z
      .string()
      .max(500, "Descrição pode ter no máximo 500 caracteres")
      .optional(),
    serviceType: z.enum(SERVICE_TYPES, {
      error: () => "Selecione um tipo de serviço válido",
    }),
    // Duração padrão opcional. `null` explícito = "sem duração"; ausente =
    // "sem duração" na criação (não há valor anterior a preservar).
    defaultDurationMin: z
      .number()
      .int("Informe a duração em minutos inteiros")
      .min(SERVICE_DURATION_LIMITS.MIN_MINUTES, `Mínimo de ${SERVICE_DURATION_LIMITS.MIN_MINUTES} minutos`)
      .max(SERVICE_DURATION_LIMITS.MAX_MINUTES, `Máximo de ${SERVICE_DURATION_LIMITS.MAX_MINUTES} minutos`)
      .nullable()
      .optional(),
    priceMin: z
      .number()
      .positive("Preço mínimo deve ser positivo")
      .max(10000, "Valor muito alto")
      .optional(),
    priceMax: z
      .number()
      .positive("Preço máximo deve ser positivo")
      .max(10000, "Valor muito alto")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.priceMin !== undefined && data.priceMax !== undefined) {
        return data.priceMax >= data.priceMin
      }
      return true
    },
    {
      message: "Preço máximo deve ser maior ou igual ao mínimo",
      path: ["priceMax"],
    }
  )

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>

export const UpdateServiceSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    serviceType: z.enum(SERVICE_TYPES).optional(),
    // Semântica de update PARCIAL, explícita:
    //   ausente (undefined) → não altera a duração já gravada
    //   null                → remove a duração (serviço passa a não ter)
    //   número              → define a duração
    defaultDurationMin: z
      .number()
      .int("Informe a duração em minutos inteiros")
      .min(SERVICE_DURATION_LIMITS.MIN_MINUTES, `Mínimo de ${SERVICE_DURATION_LIMITS.MIN_MINUTES} minutos`)
      .max(SERVICE_DURATION_LIMITS.MAX_MINUTES, `Máximo de ${SERVICE_DURATION_LIMITS.MAX_MINUTES} minutos`)
      .nullable()
      .optional(),
    priceMin: z.number().positive().max(10000).optional(),
    priceMax: z.number().positive().max(10000).optional(),
  })
  .refine(
    (data) => {
      if (data.priceMin !== undefined && data.priceMax !== undefined) {
        return data.priceMax >= data.priceMin
      }
      return true
    },
    {
      message: "Preço máximo deve ser maior ou igual ao mínimo",
      path: ["priceMax"],
    }
  )

export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS DE DISCOVERY
// Usados na busca pública de profissionais
// Ponto de extensão: o Ranking Engine da Fase 4 adiciona campos aqui
// ─────────────────────────────────────────────────────────────────────────────

export const FindProfessionalsSchema = z.object({
  // Opcional: "Todas as cidades" no filtro do Discovery busca sem
  // restrição de cidade (ver findPublicProfessionals).
  city: z.string().min(2, "Cidade é obrigatória").optional(),
  // Location Foundation V0 — filtro textual opcional por bairro. Comparação
  // case-insensitive no banco; a normalização (acentos via dicionário de
  // cidades, capitalização) acontece na action antes da query.
  neighborhood: z.string().min(2).max(100).optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  // Proximity V1 — não filtram nem ordenam a query; usados só para calcular
  // locationLabel por profissional no mapeamento do DTO (ver
  // findPublicProfessionals / resolveLocationLabel).
  tutorCity: z.string().optional(),
  tutorNeighborhood: z.string().optional(),
  // Campos reservados para o Ranking Engine (Fase 4)
  // petSpecies: z.enum(SPECIES).optional(),
  // hasSpecialNeeds: z.boolean().optional(),
  // maxDistanceKm: z.number().positive().optional(),
  limit: z.number().int().positive().max(50).default(20),
  offset: z.number().int().min(0).default(0),
})

export type FindProfessionalsInput = z.infer<typeof FindProfessionalsSchema>

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DOMÍNIO PUROS
// ─────────────────────────────────────────────────────────────────────────────

export type ProfessionalProfileData = {
  id: string
  userId: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  phone: string | null
  neighborhood: string | null
  city: string
  state: string
  lat: number | null
  lng: number | null
  serviceRadiusKm: number | null
  serviceTypes: ServiceType[]
  specializations: string[]

  /**
   * Trust Score — READ ONLY a partir da camada de aplicação.
   *
   * Este campo é calculado e atualizado EXCLUSIVAMENTE pelo Trust Engine
   * (trigger PostgreSQL — Fase 4). Nenhuma Server Action deve escrever
   * diretamente neste campo. Qualquer tentativa é uma violação de invariante.
   *
   * Fluxo correto:
   *   Review criada → TrustEvent inserido → trigger recalcula trustScore
   *
   * trustScore: Float — de 0.0 a 100.0 (sem teto fixo, ponderado por decay)
   */
  trustScore: number

  /**
   * Trust Level — READ ONLY.
   * Categoria derivada do trustScore pelo Trust Engine.
   * INITIAL → BUILDING → ESTABLISHED → TRUSTED → ELITE
   */
  trustLevel: TrustLevel

  /**
   * isVerified — concessão do sistema, nunca comprada.
   * Atribuído por moderação humana ou por critérios automáticos do sistema.
   */
  isVerified: boolean
  verifiedAt: Date | null
  verifiedIdentity: boolean

  /**
   * planType — plano do profissional.
   * Monetização por ferramenta operacional, NUNCA por visibilidade.
   * O trustScore e ranking são independentes do plano.
   */
  planType: PlanType
  planExpiresAt: Date | null

  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ServiceData = {
  id: string
  professionalId: string
  name: string
  description: string | null
  serviceType: ServiceType
  /** Duração padrão prevista, em minutos. Null = serviço sem duração declarada. */
  defaultDurationMin: number | null
  priceMin: number | null
  priceMax: number | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * ProfessionalPublicProfile — projeção para a camada de discovery.
 *
 * Contém apenas os campos seguros para exibição pública.
 * Exclui: phone (privacidade), userId, planExpiresAt.
 * Inclui: serviços ativos (necessário para filtros e exibição no card).
 *
 * Ponto de extensão do Ranking Engine:
 *   Esta estrutura é o "documento" que o Ranking Engine consome para
 *   pontuar e ordenar resultados contextuais na Fase 4.
 */
export type ProfessionalPublicProfile = Omit<
  ProfessionalProfileData,
  // lat/lng/serviceRadiusKm são dados internos — nunca entram na projeção
  // pública (ver docs/LOCATION_PRIVACY_POLICY.md). Removidos do DTO antes de
  // qualquer coleta real desses campos (pré-requisito da Location V1).
  "userId" | "phone" | "planExpiresAt" | "deletedAt" | "updatedAt" | "lat" | "lng" | "serviceRadiusKm"
> & {
  // `defaultDurationMin` é OPCIONAL de propósito: só a projeção de DETALHE
  // (findPublicProfessionalById, que alimenta o fluxo de solicitação) o
  // seleciona, porque só ela precisa decidir se o serviço aceita agendamento
  // com horário (Service Duration Integrity). A listagem de descoberta segue
  // sem o campo — não é dado reputacional nem atributo público do
  // profissional, e não há motivo para trafegá-lo onde ninguém decide nada
  // com ele. Ausente é tratado como "sem duração" por
  // `isReliableServiceDuration`.
  services: (Pick<ServiceData, "id" | "name" | "serviceType" | "priceMin" | "priceMax"> & {
    defaultDurationMin?: number | null
  })[]
  /** Contagem real de reviews visíveis e não-flagadas desta projeção. */
  reviewCount: number
  /** Média real de ratings — null quando não há reviews. */
  averageRating: number | null
  /**
   * Proximity V1 — label de localização humana ("Atende seu bairro" /
   * "Atende sua cidade" / "Cidade — UF" como fallback). Calculado no
   * repository a partir de tutorCity/tutorNeighborhood — nunca expõe
   * lat/lng/distância real.
   */
  locationLabel: string
}
