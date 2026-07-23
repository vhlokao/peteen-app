/**
 * Módulo: service-request
 * Camada: domain
 *
 * Este é o core transacional do Peteen.
 * Toda interação tutor ↔ profissional passa por um ServiceRequest.
 *
 * Decisão de design: a máquina de estados é representada como dados puros
 * (Records de arrays), não como código imperativo espalhado em condicionais.
 * Isso garante:
 *   - A tabela completa de transições é visível em um único lugar
 *   - Adicionar um estado novo requer apenas alterar os dados, não a lógica
 *   - As regras de autorização (quem pode transitar) também são dados
 *   - Testabilidade: o comportamento da máquina pode ser testado sem banco
 */

import { z } from "zod"
import type { ActionResult } from "@/modules/tutor/domain/types"
import type { ServiceType } from "@/modules/professional/domain/types"
import type { Species } from "@/modules/tutor/domain/types"

export type { ActionResult }

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS DE DOMÍNIO
// ─────────────────────────────────────────────────────────────────────────────

export const REQUEST_STATUS = [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED_BY_TUTOR",
  "CANCELLED_BY_PROFESSIONAL",
  "DISPUTED",
  "EXPIRED",
] as const
export type RequestStatus = (typeof REQUEST_STATUS)[number]

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "Aguardando resposta",
  ACCEPTED: "Aceito",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED_BY_TUTOR: "Cancelado pelo tutor",
  CANCELLED_BY_PROFESSIONAL: "Cancelado pelo profissional",
  DISPUTED: "Em disputa",
  EXPIRED: "Expirado",
}

export const TRUST_EVENT_TYPES = [
  "REVIEW_POSITIVE",
  "REVIEW_NEGATIVE",
  "REVIEW_NEUTRAL",
  "RECURRENCE_COMPLETED",
  "CANCELLATION_BY_PRO",
  "CANCELLATION_BY_TUTOR",
  "RECOMMENDATION",
  "IDENTITY_VERIFIED",
  "FRAUD_FLAG",
  "FRAUD_FLAG_RESOLVED",
] as const
export type TrustEventType = (typeof TRUST_EVENT_TYPES)[number]

// ─────────────────────────────────────────────────────────────────────────────
// MÁQUINA DE ESTADOS — definida como dado, não como código
//
// Representação: cada chave é um estado de origem.
// O valor é a lista de estados de destino permitidos.
// Transições ausentes = proibidas.
//
// Regra: nunca adicionar lógica de transição fora deste mapa.
// Toda verificação de validade passa por `isValidTransition()`.
// ─────────────────────────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Readonly<
  Record<RequestStatus, readonly RequestStatus[]>
> = {
  PENDING: [
    "ACCEPTED",               // profissional aceita
    "CANCELLED_BY_TUTOR",     // tutor cancela antes da resposta
    "CANCELLED_BY_PROFESSIONAL", // profissional rejeita
    "EXPIRED",                // sistema expira (sem interação no prazo)
  ],
  ACCEPTED: [
    "IN_PROGRESS",            // profissional inicia atendimento
    "COMPLETED",              // profissional marca como concluído (skip IN_PROGRESS permitido)
    "CANCELLED_BY_TUTOR",     // tutor cancela após aceitação
    "CANCELLED_BY_PROFESSIONAL", // profissional cancela após aceitação (impacto no trust)
  ],
  IN_PROGRESS: [
    "COMPLETED",              // profissional marca como concluído
  ],
  // Estados terminais — sem saída possível
  COMPLETED:                  [],
  CANCELLED_BY_TUTOR:         [],
  CANCELLED_BY_PROFESSIONAL:  [],
  // DISPUTED não é alcançável via transição de status.
  // Disputa é uma entidade separada (Dispute) que coexiste
  // com a solicitação. O status permanece no estado anterior
  // (ACCEPTED ou IN_PROGRESS) quando uma disputa é aberta.
  DISPUTED:                   [],
  EXPIRED:                    [],
} as const

/**
 * Ator autorizado a disparar cada transição específica.
 * Chave: "ESTADO_ORIGEM->ESTADO_DESTINO"
 *
 * Regra de autorização: antes de aplicar qualquer transição, a Server Action
 * verifica se o ator autenticado corresponde ao papel requerido aqui.
 *
 * 'system' = apenas disparado por jobs automáticos (fora desta fase)
 */
export const TRANSITION_ACTOR: Readonly<
  Record<string, "tutor" | "professional" | "either" | "system">
> = {
  "PENDING->ACCEPTED":                    "professional",
  "PENDING->CANCELLED_BY_TUTOR":          "tutor",
  "PENDING->CANCELLED_BY_PROFESSIONAL":   "professional",
  "PENDING->EXPIRED":                     "system",
  "ACCEPTED->IN_PROGRESS":               "professional",
  "ACCEPTED->COMPLETED":                  "professional",
  "ACCEPTED->CANCELLED_BY_TUTOR":         "tutor",
  "ACCEPTED->CANCELLED_BY_PROFESSIONAL":  "professional",
  "IN_PROGRESS->COMPLETED":              "professional",
} as const

/**
 * TrustEvents emitidos passivamente em cada transição.
 * null = sem evento nesta transição.
 *
 * Regra: apenas o módulo service-request emite eventos de cancelamento e recorrência.
 * Eventos de review são emitidos exclusivamente pelo módulo review.
 *
 * Os pesos (weights) estão documentados aqui como contrato do domínio.
 * O Trust Engine da Fase 4 pode ajustá-los via configuração sem tocar neste código.
 */
export const TRANSITION_TRUST_EVENTS: Readonly<
  Record<string, { type: TrustEventType; weight: number; affectedParty: "professional" | "tutor" } | null>
> = {
  "PENDING->ACCEPTED":                    null,
  "PENDING->CANCELLED_BY_TUTOR":          null,
  "PENDING->CANCELLED_BY_PROFESSIONAL":   {
    type: "CANCELLATION_BY_PRO",
    weight: -2.0,
    affectedParty: "professional",
  },
  "ACCEPTED->IN_PROGRESS":               null,
  "ACCEPTED->COMPLETED":                  null, // RECURRENCE_COMPLETED emitido em completeServiceRequest
  "ACCEPTED->CANCELLED_BY_TUTOR":         null,
  "ACCEPTED->CANCELLED_BY_PROFESSIONAL":  {
    type: "CANCELLATION_BY_PRO",
    weight: -4.0, // peso maior — cancelou após confirmar
    affectedParty: "professional",
  },
  "IN_PROGRESS->COMPLETED":              null, // idem — RECURRENCE_COMPLETED em completeServiceRequest
} as const

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÕES PURAS DA MÁQUINA DE ESTADOS
// Zero dependências — testáveis de forma isolada
// ─────────────────────────────────────────────────────────────────────────────

export function isValidTransition(
  from: RequestStatus,
  to: RequestStatus
): boolean {
  return (VALID_TRANSITIONS[from] as readonly string[]).includes(to)
}

export function isTerminalStatus(status: RequestStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0
}

export function getTransitionKey(from: RequestStatus, to: RequestStatus): string {
  return `${from}->${to}`
}

export function getAuthorizedActor(
  from: RequestStatus,
  to: RequestStatus
): "tutor" | "professional" | "either" | "system" | null {
  const key = getTransitionKey(from, to)
  return TRANSITION_ACTOR[key] ?? null
}

export function getTrustEventForTransition(
  from: RequestStatus,
  to: RequestStatus
): { type: TrustEventType; weight: number; affectedParty: "professional" | "tutor" } | null {
  const key = getTransitionKey(from, to)
  return TRANSITION_TRUST_EVENTS[key] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS DE VALIDAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export const CreateServiceRequestSchema = z.object({
  professionalId: z.string().min(1, "Profissional é obrigatório"),
  petId: z.string().min(1, "Pet é obrigatório"),
  serviceType: z.enum(
    [
      "DOG_WALK",
      "PET_SITTING",
      "BOARDING",
      "GROOMING",
      "TRAINING",
      "VET_ACCOMPANY",
      "DAY_CARE",
      "HOME_CARE",
      "OTHER",
    ] as const,
    { error: () => "Selecione um tipo de serviço válido" }
  ),
  scheduledAt: z.coerce
    .date()
    .refine((d) => d > new Date(), "A data agendada deve ser no futuro"),
  notes: z.string().max(500, "Observações podem ter no máximo 500 caracteres").optional(),

  // ── Recorrência ────────────────────────────────────────────────────────────
  // isRecurring: indica que este request faz parte de uma relação recorrente
  // parentRequestId: aponta para o request anterior na série (histórico)
  // seriesId: agrupa todos os requests da série (discovery e CRM na Fase 4)
  // recurrenceRule: padrão RRULE para agendamento automático (Fase 4)
  // recurrenceEndsAt: quando a série expira (Fase 4)
  isRecurring: z.boolean().default(false),
  parentRequestId: z.string().optional(),
  seriesId: z.string().optional(),
  recurrenceRule: z.string().optional(),
  recurrenceEndsAt: z.coerce.date().optional(),
})

export type CreateServiceRequestInput = z.infer<typeof CreateServiceRequestSchema>

export const CancelServiceRequestSchema = z.object({
  reason: z.string().max(300, "Motivo pode ter no máximo 300 caracteres").optional(),
})
export type CancelServiceRequestInput = z.infer<typeof CancelServiceRequestSchema>

export const CompleteServiceRequestSchema = z.object({
  // nextScheduledAt: hint de quando o próximo atendimento deve ocorrer
  // Armazenado no request atual para que o CRM possa sugerir o próximo agendamento
  // Não cria automaticamente um novo request (Fase 4)
  nextScheduledAt: z.coerce.date().optional(),
})
export type CompleteServiceRequestInput = z.infer<typeof CompleteServiceRequestSchema>

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DOMÍNIO PUROS
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceRequestData = {
  id: string
  tutorId: string            // TutorProfile.id
  professionalId: string     // ProfessionalProfile.id
  petId: string | null
  serviceType: ServiceType
  status: RequestStatus
  scheduledAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  notes: string | null

  // Recorrência
  isRecurring: boolean
  parentRequestId: string | null
  seriesId: string | null
  recurrenceRule: string | null
  recurrenceEndsAt: Date | null
  nextScheduledAt: Date | null

  createdAt: Date
  updatedAt: Date
}

/**
 * ServiceRequestWithParticipants — projeção para listagens e detalhes.
 *
 * Inclui sumários de tutor, profissional e pet para evitar N+1 queries.
 * O campo `review` permite que a UI saiba se uma review já foi criada
 * (evita criar duplicata sem precisar de query extra).
 *
 * Esta estrutura é o "documento" que o módulo CRM consumirá na Fase 4
 * para montar o histórico de atendimentos por cliente.
 */
export type ServiceRequestWithParticipants = ServiceRequestData & {
  tutor: {
    id: string
    displayName: string
    avatarUrl: string | null
    city: string
  }
  professional: {
    id: string
    displayName: string
    avatarUrl: string | null
    city: string
    trustScore: number
  }
  pet: {
    id: string
    name: string
    species: Species
    breed: string | null
    hasSpecialNeeds: boolean
  } | null
  review: {
    id: string
    rating: number
  } | null
}

/**
 * TrustEventPayload — payload para emissão de TrustEvents.
 * Estrutura interna usada pelo repositório para persistir eventos.
 */
export type TrustEventPayload = {
  actorId: string         // User.id (quem gerou o evento)
  targetId: string        // User.id (quem recebe o impacto reputacional)
  type: TrustEventType
  weight: number
  context: Record<string, unknown>
  relatedRequestId: string
}
