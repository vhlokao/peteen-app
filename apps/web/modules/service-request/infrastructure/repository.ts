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
import { applyRelationshipEvent } from "@/modules/relationship/infrastructure/repository"
import {
  AGENDA_BLOCKING_STATUSES,
  AgendaConflictError,
  findAgendaConflict,
} from "../domain/agenda-conflict"
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
    /** true só quando o fluxo de origem capturou horário real (ver
     *  domain/schedule-precision.ts). Default false preserva a semântica
     *  legada de "precisão de dia" para qualquer chamador que não informe. */
    scheduledHasTime?: boolean
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
      scheduledHasTime: data.scheduledHasTime ?? false,
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
//   1. Status só é atualizado se o registro ainda estiver em `fromStatus`
//      (guard otimista via updateMany — ver ConcurrentStatusChangeError abaixo)
//   2. Timestamps corretos são registrados (startedAt, completedAt)
//   3. nextScheduledAt é registrado se informado (para CRM e sugestão de recorrência)
//   4. TrustEvent é inserido NA MESMA TRANSAÇÃO — sem eventos órfãos
//   5. Se qualquer parte falhar, tudo é revertido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lançado quando `transitionStatus` não encontra o registro no `fromStatus`
 * esperado — outra transição já mudou o status entre a leitura (na Server
 * Action) e este update. É o guard atômico contra a race condition de duas
 * transições concorrentes lidas a partir do mesmo status obsoleto.
 */
export class ConcurrentStatusChangeError extends Error {
  constructor(requestId: string) {
    super(`ServiceRequest ${requestId} não estava mais no status esperado.`)
    this.name = "ConcurrentStatusChangeError"
  }
}

/**
 * Dados do request sendo aceito, lidos UMA vez no início da transação e
 * repassados adiante. Evita reler a mesma linha em cada etapa e garante que
 * congelamento e checagem de conflito operem sobre exatamente o mesmo estado.
 */
type AcceptCandidate = {
  professionalId: string
  serviceType: ServiceType
  scheduledAt: Date | null
  scheduledHasTime: boolean
}

/**
 * Agenda Conflict Safety — serializa os aceites de UM MESMO profissional.
 *
 * Por que é necessário: o guard de conflito é um check-then-write. Sob READ
 * COMMITTED, duas transações simultâneas leem "sem conflito" e ambas commitam
 * — comprovado em QA (6/6 execuções produziram dois compromissos sobrepostos).
 * O lock fecha essa janela: a segunda transação espera a primeira commitar e
 * então lê o estado já atualizado, encontrando o conflito.
 *
 * Por que `pg_advisory_xact_lock` e não lock de sessão: locks transacionais são
 * liberados automaticamente no COMMIT e no ROLLBACK, sem `unlock` explícito, e
 * são seguros sob o pgBouncer em transaction pooling que o projeto usa
 * (DATABASE_URL porta 6543). Um lock de sessão (`pg_advisory_lock`) vazaria
 * entre requests, porque a conexão física é reciclada entre transações.
 *
 * Chave: `hashtextextended(professionalId, 0)` → bigint de 64 bits, calculado
 * pelo próprio Postgres. Espaço de 2^64 torna colisão irrelevante; uma colisão
 * hipotética apenas serializaria dois profissionais distintos por alguns
 * milissegundos, sem afetar correção. `hashtext` (32 bits) não foi usado por
 * ter espaço pequeno demais para conforto.
 *
 * O `professionalId` vai como PARÂMETRO ($1), nunca concatenado no SQL.
 *
 * Adquirido para TODO aceite, inclusive sem horário: uma única ordem de
 * operações em todos os caminhos é mais fácil de auditar do que uma
 * bifurcação condicional, e o custo de um lock não contencioso é desprezível.
 */
async function lockProfessionalAgenda(
  tx: Prisma.TransactionClient,
  professionalId: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${professionalId}, 0))`
}

/**
 * Congela a duração prevista no momento do aceite.
 *
 * Resolução do Service: `ServiceRequest` guarda `serviceType` (enum), não um
 * `serviceId` — não existe FK para Service no schema. Portanto a duração é
 * resolvida por (professionalId + serviceType + isActive). Quando o
 * profissional tem mais de um serviço ativo do mesmo tipo, a escolha é
 * determinística (o mais antigo) para que dois aceites do mesmo request nunca
 * divirjam. Amarrar o request a um `serviceId` real é mudança de modelo —
 * fora do escopo desta etapa.
 *
 * Retorna ambos null quando: não há horário real (`scheduledHasTime` false),
 * não há `scheduledAt`, ou o serviço não declara duração. Nesses casos o
 * aceite prossegue normalmente.
 */
async function freezeDurationForAccept(
  tx: Prisma.TransactionClient,
  request: AcceptCandidate
): Promise<{ durationMin: number | null; endAt: Date | null }> {
  const service = await tx.service.findFirst({
    where: {
      professionalId: request.professionalId,
      serviceType: request.serviceType,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: { defaultDurationMin: true },
  })

  const durationMin = service?.defaultDurationMin ?? null
  if (durationMin === null) return { durationMin: null, endAt: null }

  // endAt só faz sentido sobre um horário real. Num request legado (precisão
  // de dia) somar minutos a uma âncora técnica produziria um fim fictício.
  if (!request.scheduledAt || !request.scheduledHasTime) {
    return { durationMin, endAt: null }
  }

  return {
    durationMin,
    endAt: new Date(request.scheduledAt.getTime() + durationMin * 60_000),
  }
}

/**
 * Agenda Conflict Safety — recusa o aceite quando o intervalo do candidato
 * sobrepõe um compromisso já confirmado do MESMO profissional.
 *
 * Executa dentro da transação do aceite, SEMPRE depois de
 * `lockProfessionalAgenda` e do congelamento da duração, usando o `endAt` que
 * será efetivamente gravado. A regra de sobreposição vive em
 * domain/agenda-conflict.ts — aqui só há I/O.
 *
 * A ordem importa: esta consulta nunca pode rodar antes do lock, senão volta a
 * existir a janela de corrida que o lock elimina.
 *
 * Lança `AgendaConflictError`, que aborta a transação inteira: nada é
 * gravado, nem status, nem duração.
 */
async function assertNoAgendaConflict(
  tx: Prisma.TransactionClient,
  requestId: string,
  candidate: AcceptCandidate,
  frozenEndAt: Date | null
): Promise<void> {
  // Sem horário real não há intervalo a defender — data civil não ocupa agenda.
  if (!candidate.scheduledHasTime || !candidate.scheduledAt) return

  const existing = await tx.serviceRequest.findMany({
    where: {
      professionalId: candidate.professionalId,
      status: { in: [...AGENDA_BLOCKING_STATUSES] },
      scheduledHasTime: true,
      id: { not: requestId },
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      scheduledHasTime: true,
      endAt: true,
    },
  })

  const conflict = findAgendaConflict(
    {
      id: requestId,
      scheduledAt: candidate.scheduledAt,
      scheduledHasTime: candidate.scheduledHasTime,
      endAt: frozenEndAt,
    },
    existing
  )

  if (conflict) throw new AgendaConflictError(conflict)
}

export async function transitionStatus(
  requestId: string,
  fromStatus: RequestStatus,
  toStatus: RequestStatus,
  options?: {
    trustEvent?: TrustEventPayload
    nextScheduledAt?: Date
  }
): Promise<ServiceRequestData> {
  const now = new Date()
  const result = await prisma.$transaction((tx) =>
    transitionStatusInTx(tx, requestId, fromStatus, toStatus, now, options)
  )
  return mapToDomain(result)
}

/**
 * Núcleo da transição, executado DENTRO de uma transação fornecida pelo
 * chamador. Extraído de `transitionStatus` para que a conclusão possa
 * compartilhar a mesma transação com a atualização do relacionamento (ver
 * `completeServiceRequestAtomic`) sem aninhar transações — Prisma não
 * suporta transação dentro de transação.
 *
 * `now` vem de fora de propósito: a conclusão usa o MESMO instante para
 * `completedAt` e para `lastServiceAt` do relacionamento, de modo que as
 * duas fontes fiquem exatamente coerentes (antes divergiam ~1s, porque cada
 * lado chamava `new Date()` separadamente).
 */
async function transitionStatusInTx(
  tx: Prisma.TransactionClient,
  requestId: string,
  fromStatus: RequestStatus,
  toStatus: RequestStatus,
  now: Date,
  options?: {
    trustEvent?: TrustEventPayload
    nextScheduledAt?: Date
  }
) {
  {
    // Timestamps específicos por estado
    const timestampData: Partial<{
      startedAt: Date
      completedAt: Date
      nextScheduledAt: Date | null
      durationMin: number | null
      endAt: Date | null
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

    // ── Agenda Foundation V0.3 — congelamento da duração no aceite ──────────
    // Na MESMA transação da transição para ACCEPTED, copia a duração padrão
    // vigente do Service e deriva o fim previsto. A partir daqui o
    // compromisso tem duração PRÓPRIA: editar o Service depois nunca
    // reescreve compromissos já aceitos.
    //
    // Tudo é lido DENTRO da transação, a partir da própria linha do request
    // (nunca de dados vindos do client). Se o serviço não declara duração, ou
    // se o request não tem horário real, ambos os campos permanecem null.
    //
    // ── ORDEM OBRIGATÓRIA do aceite (não reordenar) ─────────────────────────
    //   1. ler a identidade do profissional (própria linha do request)
    //   2. LOCK da agenda desse profissional  ← antes de qualquer leitura de
    //      estado de agenda, senão a janela de corrida reabre
    //   3. congelar a duração
    //   4. checar conflito
    //   5. transição PENDING → ACCEPTED (updateMany com guard de fromStatus)
    // Todas as etapas usam o MESMO `tx`.
    if (toStatus === "ACCEPTED") {
      const candidate = await tx.serviceRequest.findUnique({
        where: { id: requestId },
        select: {
          professionalId: true,
          serviceType: true,
          scheduledAt: true,
          scheduledHasTime: true,
        },
      })

      // Request inexistente: nada a congelar nem a proteger. O guard de
      // `fromStatus` abaixo falha de forma controlada.
      if (candidate) {
        await lockProfessionalAgenda(tx, candidate.professionalId)

        const frozen = await freezeDurationForAccept(tx, candidate)
        timestampData.durationMin = frozen.durationMin
        timestampData.endAt = frozen.endAt

        await assertNoAgendaConflict(tx, requestId, candidate, frozen.endAt)
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Guard atômico: só atualiza se o status ainda for `fromStatus`.
    // Se outro processo já transicionou o request (ex.: tutor cancelou e
    // profissional aceitou quase ao mesmo tempo), count é 0 e nada é escrito.
    const { count } = await tx.serviceRequest.updateMany({
      where: { id: requestId, status: fromStatus },
      data: {
        status: toStatus,
        ...timestampData,
      },
    })

    if (count === 0) {
      throw new ConcurrentStatusChangeError(requestId)
    }

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

    return tx.serviceRequest.findUniqueOrThrow({ where: { id: requestId } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// completeServiceRequestAtomic
//
// Conclusão de atendimento como UMA unidade atômica.
//
// Antes: `transitionStatus` commitava a mudança para COMPLETED e só DEPOIS,
// fora de qualquer transação, `updateRelationship` incrementava os contadores
// — e engolia o próprio erro. Se aquela segunda etapa falhasse, a request
// ficava COMPLETED para sempre com o relacionamento defasado, sem alarme.
// Foi exatamente esse tipo de lacuna que produziu a deriva histórica.
//
// Agora, dentro de uma única transação:
//   1. status → COMPLETED (guard otimista por `fromStatus`, gate idempotente)
//   2. completedAt
//   3. TrustEvent RECURRENCE_COMPLETED, quando elegível (decidido pelo chamador)
//   4. upsert/incremento do relacionamento + derivados (score e level)
//
// Ou tudo é gravado, ou nada é. Um retry da mesma request continua barrado
// pelo mesmo guard de `fromStatus`, então nada é contado duas vezes.
//
// O que NÃO entra aqui (ver comentários em completeServiceRequestAction):
// AuditLog, updateProfessionalTrust, detectArtificialRecurrence e
// revalidatePath — nenhum deles é necessário para a consistência do
// relacionamento, e dois deles precisam ler o estado já commitado.
// ─────────────────────────────────────────────────────────────────────────────

export async function completeServiceRequestAtomic(params: {
  requestId: string
  fromStatus: RequestStatus
  tutorId: string
  professionalId: string
  trustEvent?: TrustEventPayload
  nextScheduledAt?: Date
}): Promise<ServiceRequestData> {
  const { requestId, fromStatus, tutorId, professionalId, trustEvent, nextScheduledAt } = params

  // Um único instante para completedAt e lastServiceAt — as duas fontes de
  // verdade da conclusão passam a coincidir exatamente.
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const request = await transitionStatusInTx(
      tx,
      requestId,
      fromStatus,
      "COMPLETED",
      now,
      { trustEvent, nextScheduledAt }
    )

    await applyRelationshipEvent(tx, tutorId, professionalId, {
      type: "SERVICE_COMPLETED",
      serviceAt: now,
    })

    return request
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
  scheduledHasTime: boolean
  durationMin: number | null
  endAt: Date | null
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
    scheduledHasTime: record.scheduledHasTime,
    durationMin: record.durationMin,
    endAt: record.endAt,
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
  scheduledHasTime: boolean
  durationMin: number | null
  endAt: Date | null
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
