/**
 * Módulo: service-request
 * Camada: infrastructure
 *
 * Responsabilidade: I/O com o banco via Prisma.
 *
 * Garantias de integridade:
 *   - `transitionStatus()` é atômica: status + timestamps + TrustEvents em uma transação
 *   - Nenhuma função modifica o status diretamente — toda mudança passa por `transitionStatus()`
 *   - TrustEvents são inseridos dentro da mesma transação do status — sem eventos órfãos
 *   - `findRequestWithOwnership()` combina existência + ownership em uma query
 *
 * Conexão com sistemas futuros:
 *   - CRM: `countCompletedRequestsBetween()` alimentará o CrmClient.totalServices
 *   - Ranking: ServiceRequest.serviceType + completedAt são inputs do ranking contextual
 *   - Antifraude: velocidade de criação de requests e padrões de cancelamento são sinais
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { ServiceType } from "@/modules/professional/domain/types"
import type { Species } from "@/modules/tutor/domain/types"
import type {
  ServiceRequestData,
  ServiceRequestWithParticipants,
  RequestStatus,
  TrustEventPayload,
} from "../domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// CRIAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export async function createServiceRequestRecord(
  data: {
    tutorId: string
    professionalId: string
    petId: string
    serviceType: ServiceType
    scheduledAt?: Date
    notes?: string
    isRecurring?: boolean
    parentRequestId?: string
    seriesId?: string
    recurrenceRule?: string
    recurrenceEndsAt?: Date
  }
): Promise<ServiceRequestData> {
  const result = await prisma.serviceRequest.create({
    data: {
      tutorId: data.tutorId,
      professionalId: data.professionalId,
      petId: data.petId,
      serviceType: data.serviceType,
      status: "PENDING",
      scheduledAt: data.scheduledAt ?? null,
      notes: data.notes ?? null,
      isRecurring: data.isRecurring ?? false,
      parentRequestId: data.parentRequestId ?? null,
      seriesId: data.seriesId ?? null,
      recurrenceRule: data.recurrenceRule ?? null,
      recurrenceEndsAt: data.recurrenceEndsAt ?? null,
      nextScheduledAt: null,
    },
  })
  return mapToDomain(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA
// ─────────────────────────────────────────────────────────────────────────────

export async function findServiceRequestById(
  id: string
): Promise<ServiceRequestData | null> {
  const result = await prisma.serviceRequest.findUnique({ where: { id } })
  return result ? mapToDomain(result) : null
}

/**
 * Telefone do profissional vinculado a uma solicitação — consulta isolada.
 *
 * Existe separada (em vez de entrar em ServiceRequestWithParticipants) porque
 * é um dado de contato sensível: só deve sair do banco quando o tutor dono da
 * solicitação realmente precisa dele (ex.: contato por WhatsApp após o aceite).
 * O filtro por `tutorId` na própria query garante o ownership — um tutor nunca
 * recebe o telefone de uma solicitação que não é dele.
 *
 * Retorna null se a solicitação não existir, não pertencer ao tutor, ou se o
 * profissional não tiver telefone cadastrado.
 */
export async function getProfessionalPhoneByRequestId(
  requestId: string,
  tutorId: string
): Promise<string | null> {
  const result = await prisma.serviceRequest.findFirst({
    where: { id: requestId, tutorId },
    select: { professional: { select: { phone: true } } },
  })

  return result?.professional.phone ?? null
}

/**
 * Busca request com dados dos participantes para exibição em listas e detalhes.
 * Inclui review associada para verificar se já foi avaliado.
 *
 * Hook para CRM (Fase 4):
 *   A estrutura retornada é o "documento" base que o CrmClient usará para
 *   construir o histórico de atendimentos entre profissional e tutor.
 */
export async function findServiceRequestWithParticipants(
  id: string
): Promise<ServiceRequestWithParticipants | null> {
  const result = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      tutor: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          city: true,
        },
      },
      professional: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          city: true,
          trustScore: true,
        },
      },
      pet: {
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          hasSpecialNeeds: true,
        },
      },
      review: {
        select: { id: true, rating: true },
      },
    },
  })

  if (!result) return null

  return {
    ...mapToDomain(result),
    tutor: result.tutor,
    professional: result.professional,
    pet: result.pet
      ? {
          ...result.pet,
          species: result.pet.species as Species,
        }
      : null,
    review: result.review ?? null,
  }
}

/**
 * Busca requests do tutor para a fila de solicitações enviadas.
 * Ordenados por data de criação descendente (mais recentes primeiro).
 */
export async function findServiceRequestsByTutorId(
  tutorId: string,
  filters?: { status?: RequestStatus; limit?: number; offset?: number }
): Promise<ServiceRequestWithParticipants[]> {
  const results = await prisma.serviceRequest.findMany({
    where: {
      tutorId,
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: {
      tutor: { select: { id: true, displayName: true, avatarUrl: true, city: true } },
      professional: { select: { id: true, displayName: true, avatarUrl: true, city: true, trustScore: true } },
      pet: { select: { id: true, name: true, species: true, breed: true, hasSpecialNeeds: true } },
      review: { select: { id: true, rating: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 20,
    skip: filters?.offset ?? 0,
  })

  return results.map(mapToWithParticipants)
}

/**
 * Busca requests do profissional para a fila de atendimentos.
 *
 * Hook para CRM (Fase 4):
 *   O CRM consumirá esta mesma query (com `status: COMPLETED`) para construir
 *   o histórico de atendimentos por cliente e calcular totalServices.
 */
export async function findServiceRequestsByProfessionalId(
  professionalId: string,
  filters?: { status?: RequestStatus; limit?: number; offset?: number }
): Promise<ServiceRequestWithParticipants[]> {
  const results = await prisma.serviceRequest.findMany({
    where: {
      professionalId,
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: {
      tutor: { select: { id: true, displayName: true, avatarUrl: true, city: true } },
      professional: { select: { id: true, displayName: true, avatarUrl: true, city: true, trustScore: true } },
      pet: { select: { id: true, name: true, species: true, breed: true, hasSpecialNeeds: true } },
      review: { select: { id: true, rating: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 20,
    skip: filters?.offset ?? 0,
  })

  return results.map(mapToWithParticipants)
}

/**
 * Busca todos os requests de uma série recorrente.
 * Fase 4: o CRM e o Ranking consumirão esta query para calcular
 * métricas de recorrência (totalServices, lastServiceAt, etc.)
 */
export async function findServiceRequestsBySeriesId(
  seriesId: string
): Promise<ServiceRequestData[]> {
  const results = await prisma.serviceRequest.findMany({
    where: { seriesId },
    orderBy: { createdAt: "asc" },
  })
  return results.map(mapToDomain)
}

/**
 * Conta atendimentos concluídos entre um tutor e um profissional.
 *
 * Hook para CRM (Fase 4):
 *   CrmClient.totalServices será populado a partir desta query.
 *   Também é usado pelo Ranking Engine para calcular o "bonus de recorrência"
 *   (profissional com histórico longo com um tutor específico recebe peso extra).
 */
export async function countCompletedRequestsBetween(
  tutorId: string,
  professionalId: string
): Promise<number> {
  return prisma.serviceRequest.count({
    where: { tutorId, professionalId, status: "COMPLETED" },
  })
}

/**
 * Verifica se já existe uma solicitação ativa (PENDING / ACCEPTED / IN_PROGRESS)
 * entre o mesmo par tutor-profissional.
 *
 * Guardrail operacional MVP:
 *   Impede que o tutor crie múltiplas solicitações abertas para o mesmo profissional,
 *   evitando estados confusos e expectativas operacionais erradas.
 */
export async function hasActiveRequestBetween(
  tutorId: string,
  professionalId: string
): Promise<boolean> {
  const count = await prisma.serviceRequest.count({
    where: {
      tutorId,
      professionalId,
      status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
    },
  })
  return count > 0
}

/**
 * Verifica se o profissional já possui outro atendimento IN_PROGRESS.
 *
 * Guardrail operacional MVP:
 *   Impede que um profissional inicie ou aceite um novo atendimento enquanto
 *   já está com um atendimento em andamento, evitando conflitos operacionais.
 *
 * @param excludeRequestId - ignora a própria request em avaliação na contagem
 */
export async function hasInProgressRequestForProfessional(
  professionalId: string,
  excludeRequestId?: string
): Promise<boolean> {
  const count = await prisma.serviceRequest.count({
    where: {
      professionalId,
      status: "IN_PROGRESS",
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
  })
  return count > 0
}

/**
 * Verifica se já existe uma conclusão recente entre o mesmo par tutor-profissional.
 *
 * Guardrail antifraude MVP:
 *   Impede que um profissional registre múltiplas conclusões para o mesmo tutor
 *   em menos de `windowHours` horas, bloqueando inflação artificial de recorrência.
 */
export async function hasRecentCompletionBetween(
  tutorId: string,
  professionalId: string,
  windowHours: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000)
  const count = await prisma.serviceRequest.count({
    where: {
      tutorId,
      professionalId,
      status:      "COMPLETED",
      completedAt: { gte: windowStart },
    },
  })
  return count > 0
}

/**
 * Verifica se um pet tem solicitações ativas (PENDING ou ACCEPTED).
 * Usado para impedir soft delete de pets com solicitações em aberto.
 */
export async function hasPendingRequestsForPet(petId: string): Promise<boolean> {
  const count = await prisma.serviceRequest.count({
    where: {
      petId,
      status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
    },
  })
  return count > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSIÇÃO DE STATUS — operação central, sempre atômica
//
// Todas as mudanças de status passam por aqui.
// Nunca chamar prisma.serviceRequest.update({ data: { status } }) diretamente.
//
// O que esta função garante:
//   1. Status é atualizado para o valor correto
//   2. Timestamps corretos são registrados (startedAt, completedAt)
//   3. nextScheduledAt é registrado se informado (para CRM e sugestão de recorrência)
//   4. TrustEvent é inserido NA MESMA TRANSAÇÃO — sem eventos órfãos
//   5. Se qualquer parte falhar, tudo é revertido
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionStatus(
  requestId: string,
  toStatus: RequestStatus,
  options?: {
    trustEvent?: TrustEventPayload
    nextScheduledAt?: Date
  }
): Promise<ServiceRequestData> {
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    // Timestamps específicos por estado
    const timestampData: Partial<{
      startedAt: Date
      completedAt: Date
      nextScheduledAt: Date | null
    }> = {}

    if (toStatus === "IN_PROGRESS") {
      timestampData.startedAt = now
    }
    if (toStatus === "COMPLETED") {
      timestampData.completedAt = now
      if (options?.nextScheduledAt !== undefined) {
        timestampData.nextScheduledAt = options.nextScheduledAt
      }
    }

    const updated = await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: toStatus,
        ...timestampData,
      },
    })

    // TrustEvent emitido dentro da mesma transação
    // Garante: ou o status muda E o evento é registrado, ou nenhum dos dois ocorre
    if (options?.trustEvent) {
      const { actorId, targetId, type, weight, context, relatedRequestId } =
        options.trustEvent
      await tx.trustEvent.create({
        data: {
          actorId,
          targetId,
          type,
          weight,
          context: context as Prisma.InputJsonValue,
          relatedRequestId,
          isFlagged: false,
        },
      })
    }

    return updated
  })

  return mapToDomain(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES DE OWNERSHIP — combinam existência + pertencimento em uma query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o request + userIds dos participantes para verificações de ownership
 * e emissão de TrustEvents (que precisam do User.id, não do Profile.id).
 */
export async function findRequestWithOwnershipContext(id: string): Promise<{
  request: ServiceRequestData
  tutorUserId: string
  professionalUserId: string
} | null> {
  const result = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      tutor: { select: { userId: true } },
      professional: { select: { userId: true } },
    },
  })

  if (!result) return null

  return {
    request: mapToDomain(result),
    tutorUserId: result.tutor.userId,
    professionalUserId: result.professional.userId,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function mapToDomain(record: {
  id: string
  tutorId: string
  professionalId: string
  petId: string | null
  serviceType: string
  status: string
  scheduledAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  notes: string | null
  isRecurring: boolean
  parentRequestId: string | null
  seriesId: string | null
  recurrenceRule: string | null
  recurrenceEndsAt: Date | null
  nextScheduledAt: Date | null
  createdAt: Date
  updatedAt: Date
}): ServiceRequestData {
  return {
    id: record.id,
    tutorId: record.tutorId,
    professionalId: record.professionalId,
    petId: record.petId,
    serviceType: record.serviceType as ServiceType,
    status: record.status as RequestStatus,
    scheduledAt: record.scheduledAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    notes: record.notes,
    isRecurring: record.isRecurring,
    parentRequestId: record.parentRequestId,
    seriesId: record.seriesId,
    recurrenceRule: record.recurrenceRule,
    recurrenceEndsAt: record.recurrenceEndsAt,
    nextScheduledAt: record.nextScheduledAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function mapToWithParticipants(result: {
  id: string
  tutorId: string
  professionalId: string
  petId: string | null
  serviceType: string
  status: string
  scheduledAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  notes: string | null
  isRecurring: boolean
  parentRequestId: string | null
  seriesId: string | null
  recurrenceRule: string | null
  recurrenceEndsAt: Date | null
  nextScheduledAt: Date | null
  createdAt: Date
  updatedAt: Date
  tutor: { id: string; displayName: string; avatarUrl: string | null; city: string }
  professional: { id: string; displayName: string; avatarUrl: string | null; city: string; trustScore: number }
  pet: { id: string; name: string; species: string; breed: string | null; hasSpecialNeeds: boolean } | null
  review: { id: string; rating: number } | null
}): ServiceRequestWithParticipants {
  return {
    ...mapToDomain(result),
    tutor: result.tutor,
    professional: result.professional,
    pet: result.pet
      ? {
          ...result.pet,
          species: result.pet.species as Species,
        }
      : null,
    review: result.review,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEV/TEST ONLY — estas funções NÃO devem ser chamadas em production.
// A proteção primária está nas Server Actions que as invocam (NODE_ENV check).
// ─────────────────────────────────────────────────────────────────────────────

export type DevActiveRequest = {
  id:               string
  status:           string
  serviceType:      string
  createdAt:        Date
  scheduledAt:      Date | null
  tutorId:          string
  professionalId:   string
  tutorName:        string
  professionalName: string
}

/**
 * Lista todas as solicitações ativas (PENDING/ACCEPTED/IN_PROGRESS).
 * Usada somente pela página /admin/dev-tools em ambiente de desenvolvimento.
 */
export async function devFindActiveRequests(): Promise<DevActiveRequest[]> {
  const rows = await prisma.serviceRequest.findMany({
    where: {
      status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
    },
    select: {
      id:           true,
      status:       true,
      serviceType:  true,
      createdAt:    true,
      scheduledAt:  true,
      tutorId:      true,
      professionalId: true,
      tutor:        { select: { displayName: true } },
      professional: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return rows.map((r) => ({
    id:               r.id,
    status:           r.status,
    serviceType:      r.serviceType,
    createdAt:        r.createdAt,
    scheduledAt:      r.scheduledAt,
    tutorId:          r.tutorId,
    professionalId:   r.professionalId,
    tutorName:        r.tutor.displayName,
    professionalName: r.professional.displayName,
  }))
}

/**
 * Força atualização de status de uma solicitação, bypassando a máquina de estados
 * e sem gerar TrustEvents reputacionais.
 *
 * Usar apenas em dev-actions com proteção NODE_ENV + admin.
 */
export async function devForceStatusUpdate(
  requestId: string,
  newStatus: "CANCELLED_BY_TUTOR" | "CANCELLED_BY_PROFESSIONAL" | "EXPIRED"
): Promise<void> {
  await prisma.serviceRequest.update({
    where: { id: requestId },
    data:  { status: newStatus },
  })
}
