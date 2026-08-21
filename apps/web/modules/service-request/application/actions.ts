"use server"

/**
 * Módulo: service-request
 * Camada: application (Server Actions)
 *
 * Este arquivo orquestra o core transacional do Peteen.
 * Toda transição de estado de um ServiceRequest passa por aqui.
 *
 * Padrão de autorização em três camadas:
 *   1. Autenticação: requireAuth() — usuário tem sessão válida?
 *   2. Identidade de domínio: tem TutorProfile OU ProfessionalProfile?
 *   3. Ownership: o perfil de domínio corresponde ao request?
 *
 * Padrão de transição de estado:
 *   1. Carrega request + contexto de ownership (uma query)
 *   2. Verifica se a transição é válida via VALID_TRANSITIONS (dados)
 *   3. Verifica se o ator é autorizado via TRANSITION_ACTOR (dados)
 *   4. Identifica TrustEvent via TRANSITION_TRUST_EVENTS (dados)
 *   5. Chama transitionStatus() — operação atômica
 *
 * Toda lógica de "quem pode fazer o quê" está nos dados do domínio,
 * não em condicionais espalhadas aqui.
 */

import { revalidatePath } from "next/cache"
import { updateProfessionalTrust } from "@/modules/trust-engine/application/update-professional-trust"
import { requireAuth } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { findProfessionalProfileByUserId } from "@/modules/professional/infrastructure/repository"
import {
  isValidTransition,
  getAuthorizedActor,
  getTrustEventForTransition,
  CreateServiceRequestSchema,
  CancelServiceRequestSchema,
  CompleteServiceRequestSchema,
  type ActionResult,
  type ServiceRequestData,
  type ServiceRequestWithParticipants,
  type RequestStatus,
  type TrustEventPayload,
} from "../domain/types"
import { buildRequestSyncToken, buildRequestListSyncToken } from "../domain/active-request-sync"
import {
  getRequestSyncSnapshot,
  getTutorRequestListSyncSnapshot,
  getProfessionalRequestListSyncSnapshot,
} from "../infrastructure/sync-snapshot"
import {
  createServiceRequestRecord,
  findServiceRequestById,
  findServiceRequestWithParticipants,
  findServiceRequestsByTutorId,
  findServiceRequestsByProfessionalId,
  findRequestWithOwnershipContext,
  transitionStatus,
  ConcurrentStatusChangeError,
  countCompletedRequestsBetween,
  completeServiceRequestAtomic,
  hasPendingRequestsForPet,
  hasActiveRequestBetween,
  hasInProgressRequestForProfessional,
} from "../infrastructure/repository"
import { isRecurrenceCreditEligible } from "@/modules/trust-engine/infrastructure/reputation-eligibility"
import { REPUTATION_CREDIT_WINDOW_HOURS } from "@/modules/trust-engine/domain/reputation-window"
import { recordRequestAudit } from "../infrastructure/audit"
import {
  trackInviteRequestCreated,
  trackInviteServiceCompleted,
} from "@/modules/invite/application/track"
import { getRequestExpiryInfo } from "../domain/request-expiry"
import {
  LEAD_TIME_ERROR_MESSAGE,
  respeitaAntecedenciaMinima,
} from "../domain/request-lead-time"
import { AgendaConflictError } from "../domain/agenda-conflict"
import {
  ServiceDurationRequiredError,
  canReceiveTimedBooking,
} from "../domain/service-duration"
import { findActiveServiceForBooking } from "@/modules/professional/infrastructure/repository"
import { syncExpiredPendingRequests, syncExpiredPendingRequest } from "./expiry-sync"

const CONCURRENT_UPDATE_MESSAGE =
  "Esta solicitação já foi atualizada. Recarregue a página para ver o status mais recente."

/**
 * Agenda Conflict Safety — mensagem exibida ao PROFISSIONAL quando o aceite
 * sobrepõe um compromisso já confirmado. Fala apenas da agenda dele: não
 * revela tutor, pet, serviço nem id do outro atendimento. O tutor nunca vê
 * esta mensagem (só o profissional aceita), então não há vazamento cruzado.
 */
const AGENDA_CONFLICT_MESSAGE =
  "Este horário entra em conflito com outro atendimento já confirmado na sua agenda."

/**
 * Service Duration Integrity — exibida ao PROFISSIONAL quando o serviço da
 * request não tem duração confiável e a request tem horário. É acionável: ele
 * resolve preenchendo a duração em /professional/services.
 */
const SERVICE_DURATION_REQUIRED_MESSAGE =
  "Defina a duração deste serviço antes de aceitar um atendimento com horário."
import { isCivilDayInThePast } from "@/lib/date/civil-day"
import { zonedCivilDateTimeToInstant } from "@/lib/date/zoned-datetime"
import {
  describeServiceStartBlock,
  resolveServiceStartEligibility,
} from "../domain/start-eligibility"
import { detectArtificialRecurrence } from "@/modules/antifraude/application/detect-artificial-recurrence"
import { isDevBypassEnabled } from "@/modules/antifraude/domain/dev-flags"
import {
  notifyRequestAccepted,
  notifyRequestCancelled,
  notifyRequestCreated,
  notifyServiceCompleted,
  notifyServiceStarted,
} from "@/modules/notifications/application/push-service-request-events"

// ─────────────────────────────────────────────────────────────────────────────
// CRIAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria uma solicitação de serviço.
 *
 * Invariantes:
 *   - Apenas tutores podem criar requests
 *   - O pet deve pertencer ao tutor autenticado
 *   - A data agendada não pode estar num dia civil anterior a hoje
 *     (America/Sao_Paulo) — hoje é válido; horário/disponibilidade são da Agenda
 *   - Se isRecurring e parentRequestId: valida que o parent existe e foi COMPLETED
 *   - Se isRecurring sem parentRequestId: gera um novo seriesId automaticamente
 *
 * Recorrência (Fase 3):
 *   - O seriesId é gerado aqui se não fornecido (primeiro da série)
 *   - Os campos de recorrência são armazenados mas NÃO processados automaticamente
 *   - O próximo request da série é criado manualmente (Fase 3) ou por automação (Fase 4)
 */
export async function createServiceRequestAction(
  input: import("../domain/types").CreateServiceRequestInput
): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const tutorProfile = await findTutorProfileByUserId(session.id)
    if (!tutorProfile) {
      return {
        success: false,
        error: "Complete o perfil de tutor antes de solicitar um serviço.",
      }
    }

    // ── Rate limiting: máx 10 solicitações por dia por tutor ──────────────────
    const { countTodayServiceRequests } = await import(
      "@/modules/moderation/infrastructure/repository"
    )
    const { RATE_LIMITS } = await import("@/modules/moderation/domain/types")
    const todayCount = await countTodayServiceRequests(tutorProfile.id)
    if (todayCount >= RATE_LIMITS.SERVICE_REQUESTS_PER_DAY) {
      // Cria flag automática de sistema e rejeita a solicitação
      const { createFlag } = await import(
        "@/modules/moderation/infrastructure/repository"
      )
      await createFlag({
        targetType: "USER",
        targetId:   session.id,
        reason:     `Rate limit excedido: ${todayCount} solicitações em 1 dia`,
        severity:   "MEDIUM",
        source:     "SYSTEM",
      }).catch(() => null)
      return {
        success: false,
        error:   `Limite diário de ${RATE_LIMITS.SERVICE_REQUESTS_PER_DAY} solicitações atingido. Tente novamente amanhã.`,
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const parsed = CreateServiceRequestSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    // ── Agenda Foundation V0.3 — data + horário civis → instante UTC ─────────
    // A conversão acontece AQUI, no servidor, a partir dos componentes civis
    // crus. O client nunca envia um instante pronto, então o resultado não
    // depende do fuso do dispositivo do tutor.
    const scheduledAt = zonedCivilDateTimeToInstant(
      parsed.data.scheduledDate,
      parsed.data.scheduledTime
    )
    if (!scheduledAt) {
      return {
        success: false,
        error: "Data ou horário inválidos.",
        fieldErrors: { scheduledTime: ["Data ou horário inválidos."] },
      }
    }

    const now = new Date()

    // Regra preservada da V0.2 — dia civil no passado é sempre inválido.
    if (isCivilDayInThePast(scheduledAt, now)) {
      return {
        success: false,
        error: "A data agendada não pode estar no passado.",
        fieldErrors: { scheduledDate: ["A data agendada não pode estar no passado."] },
      }
    }

    // Regra nova — agora que existe horário real, o instante também não pode
    // estar no passado. Isso permite qualquer horário FUTURO no mesmo dia e
    // rejeita um horário de hoje que já passou.
    if (scheduledAt.getTime() < now.getTime()) {
      return {
        success: false,
        error: "O horário escolhido já passou. Escolha um horário futuro.",
        fieldErrors: { scheduledTime: ["O horário escolhido já passou."] },
      }
    }

    // ── Antecedência mínima — gate de ADMISSÃO ───────────────────────────────
    // Estar no futuro não basta. Sem este guard, uma solicitação podia nascer
    // com segundos de janela e expirar imediatamente (caso real: criada
    // 21:12:29 para 21:13:00, expirada 40s depois) — a regra de expiração
    // fazia o certo, mas nunca deveria ter recebido esse pedido.
    //
    // O `min` do input de horário na UI já bloqueia isso visualmente, mas
    // `min` de <input> não é proteção: qualquer chamada direta desta Server
    // Action passaria. Este é o guard de verdade.
    if (!respeitaAntecedenciaMinima(scheduledAt, now)) {
      return {
        success: false,
        error: LEAD_TIME_ERROR_MESSAGE,
        fieldErrors: { scheduledTime: [LEAD_TIME_ERROR_MESSAGE] },
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Service Duration Integrity — gate server-side ────────────────────────
    // Toda request criada por este fluxo tem horário real (scheduledHasTime é
    // gravado como true logo abaixo), então o serviço precisa ter duração
    // confiável — sem ela a Agenda não consegue decidir sobreposição parcial.
    //
    // A UI já não oferece esses serviços para agendamento, mas o estado
    // `disabled` de um <option> não é proteção: qualquer chamada direta da
    // Server Action passaria. Este é o guard de verdade.
    //
    // Resolve o serviço por (professionalId + serviceType + isActive) — a mesma
    // resolução que `freezeDurationForAccept` usa no aceite, e que o Service
    // Uniqueness garante ser determinística (no máximo um ativo por tipo).
    const servicoDoPedido = await findActiveServiceForBooking(
      parsed.data.professionalId,
      parsed.data.serviceType
    )

    if (!servicoDoPedido || !canReceiveTimedBooking(servicoDoPedido)) {
      // Mensagem neutra: nunca culpa o profissional nem expõe configuração
      // interna dele. Para BOARDING a limitação é do produto (hospedagem
      // multi-dia não é representável em minutos), então o texto é diferente.
      const ehHospedagem = parsed.data.serviceType === "BOARDING"
      const mensagem = ehHospedagem
        ? "Agendamento de hospedagem estará disponível em breve."
        : "Este profissional ainda não configurou a duração deste serviço para agendamentos com horário."
      return {
        success: false,
        error: mensagem,
        fieldErrors: { serviceType: [mensagem] },
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Guardrail operacional: solicitação duplicada em aberto ───────────────
    // Impede que o tutor abra múltiplas solicitações ativas para o mesmo profissional.
    // Bypassável em development via DEV_BYPASS_OPERATIONAL_GUARDRAILS=true (.env.local).
    if (!isDevBypassEnabled("operational")) {
      const hasDuplicate = await hasActiveRequestBetween(
        tutorProfile.id,
        parsed.data.professionalId
      )
      if (hasDuplicate) {
        return {
          success: false,
          error:
            "Você já possui uma solicitação em andamento com este profissional. Finalize ou cancele a solicitação atual antes de criar uma nova.",
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Ownership: o pet deve pertencer ao tutor autenticado
    const { findPetByIdAndTutorId } = await import(
      "@/modules/tutor/infrastructure/repository"
    )
    const pet = await findPetByIdAndTutorId(parsed.data.petId, tutorProfile.id)
    if (!pet) {
      return { success: false, error: "Pet não encontrado ou não pertence a você." }
    }

    // Recorrência: valida parentRequestId se fornecido
    if (parsed.data.parentRequestId) {
      const parentRequest = await findServiceRequestById(parsed.data.parentRequestId)
      if (!parentRequest) {
        return { success: false, error: "Request pai não encontrado." }
      }
      if (parentRequest.status !== "COMPLETED") {
        return {
          success: false,
          error: "Request pai deve estar concluído para criar um novo na série.",
        }
      }
      if (parentRequest.tutorId !== tutorProfile.id) {
        return { success: false, error: "Request pai não pertence ao seu perfil." }
      }
    }

    // Recorrência: gera seriesId se isRecurring e não fornecido
    let seriesId = parsed.data.seriesId
    if (parsed.data.isRecurring && !seriesId) {
      // Novo série — gera um ID único para agrupar futuros requests
      // Formato: sr-{requestId será gerado} — usamos timestamp + random como seed
      seriesId = `series-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    }

    const request = await createServiceRequestRecord({
      tutorId: tutorProfile.id,
      professionalId: parsed.data.professionalId,
      petId: parsed.data.petId,
      serviceType: parsed.data.serviceType,
      scheduledAt,
      // Este fluxo capturou horário real → precisão de minuto.
      // Nenhum outro ponto do sistema escreve este campo.
      scheduledHasTime: true,
      notes: parsed.data.notes,
      isRecurring: parsed.data.isRecurring,
      parentRequestId: parsed.data.parentRequestId,
      seriesId,
      recurrenceRule: parsed.data.recurrenceRule,
      recurrenceEndsAt: parsed.data.recurrenceEndsAt,
    })

    // ── Push best-effort — a solicitação JÁ está persistida acima ────────────
    // Roda depois da escrita e nunca lança (a própria função engole tudo), no
    // mesmo espírito de `recordRequestAudit`. Falha de push não pode impedir a
    // criação, causar rollback, nem tocar Trust/Relationship/Agenda.
    // O destinatário (profissional) é resolvido server-side lá dentro, a partir
    // da própria request — nunca vem do client.
    await notifyRequestCreated(request.id)

    // Funil de convite — REQUEST_CREATED. Só credita a visita cujo
    // profissional é o MESMO desta request: um tutor que chegou pela landing
    // de A e contratou B não conta para A. Best-effort, nunca bloqueia.
    await trackInviteRequestCreated(session.id, request.professionalId)

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")

    return { success: true, data: request }
  } catch (err) {
    console.error("[createServiceRequestAction]", err)
    return { success: false, error: "Erro interno ao criar solicitação." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSIÇÕES DE STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aceita uma solicitação. Apenas profissionais. PENDING → ACCEPTED.
 *
 * Guardrail operacional MVP:
 *   Bloqueia aceite se o profissional já possui outro atendimento IN_PROGRESS,
 *   evitando conflito operacional antes de existir agenda real.
 */
export async function acceptServiceRequestAction(
  requestId: string
): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, professionalUserId } = ctx

    if (professionalUserId !== session.id) {
      return {
        success: false,
        error: "Apenas o profissional pode realizar esta ação.",
      }
    }

    const toStatus: RequestStatus = "ACCEPTED"
    if (!isValidTransition(request.status, toStatus)) {
      return {
        success: false,
        error: `Transição inválida: "${request.status}" → "${toStatus}".`,
      }
    }

    // ── Defesa obrigatória: nunca aceitar uma request vencida ─────────────────
    // O cron (1x/dia) e a sincronização lazy nas listagens/detalhe cobrem a
    // maioria dos casos, mas nenhum dos dois garante que uma request vencida
    // nunca chegue até aqui — esta é a última linha de defesa, sempre
    // executada, independente de quando o cron rodou por último ou de qual
    // tela o profissional usou pra chegar na ação. Mesma fonte de verdade
    // (getRequestExpiryInfo) usada pelo cron e pela sincronização lazy.
    //
    // Sem AuditLog aqui: o profissional tentou aceitar, mas quem causou a
    // expiração foi a passagem do tempo, não a ação dele — registrar
    // "request.expired" com ele como ator seria autoria falsa. Não existe
    // hoje uma taxonomia de AuditLog para "tentativa de aceite bloqueada por
    // vencimento", e criar uma nova sem aprovação está fora do escopo desta
    // correção — por isso só log operacional estruturado, sem PII.
    const expiryInfo = getRequestExpiryInfo(request.createdAt, request.scheduledAt)
    if (expiryInfo.isExpired) {
      try {
        await transitionStatus(requestId, "PENDING", "EXPIRED")
        console.info("[acceptServiceRequestAction] expired on accept attempt", { requestId })
      } catch (err) {
        // ConcurrentStatusChangeError: outro processo (cron ou outra tentativa
        // de aceite) já decidiu o destino desta request — o resultado final já
        // é válido e único, não precisa de nova escrita. Qualquer outro erro é
        // só logado: mesmo que a escrita de EXPIRED falhe, o aceite abaixo
        // continua bloqueado — nunca faz sentido aceitar uma request vencida
        // só porque não conseguimos marcá-la como tal.
        if (!(err instanceof ConcurrentStatusChangeError)) {
          console.error("[acceptServiceRequestAction] falha ao expirar request vencida", err)
        }
      }
      return {
        success: false,
        error: "O prazo para responder a esta solicitação terminou.",
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Guardrail operacional: não aceitar com atendimento em andamento ───────
    // Bypassável em development via DEV_BYPASS_OPERATIONAL_GUARDRAILS=true (.env.local).
    if (!isDevBypassEnabled("operational")) {
      const busy = await hasInProgressRequestForProfessional(
        request.professionalId,
        requestId
      )
      if (busy) {
        return {
          success: false,
          error:
            "Você já possui um atendimento em andamento. Finalize o atendimento atual antes de aceitar uma nova solicitação.",
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Nenhum cooldown de 24h aqui: uma conclusão recente entre este mesmo par
    // não impede mais aceitar um atendimento real. Dois passeios no mesmo dia,
    // outro pet, outro serviço ou recorrência diária são casos legítimos, e
    // travá-los criava solicitações válidas na tela do tutor que o
    // profissional não conseguia aceitar. A proteção contra inflação
    // reputacional passou a viver onde o risco de fato existe — na
    // elegibilidade do crédito de Trust, em completeServiceRequestAction e em
    // createReviewAction (ver trust-engine/infrastructure/reputation-eligibility.ts).

    const fromStatus = request.status
    const updated = await transitionStatus(requestId, fromStatus, toStatus)

    await recordRequestAudit(
      session.id,
      "request.accepted",
      requestId,
      { status: fromStatus },
      { status: toStatus }
    )

    // ── Push best-effort — ACCEPTED JÁ está persistido acima ─────────────────
    // Só o aceite VENCEDOR chega aqui: `transitionStatus` só escreve se o
    // status ainda for PENDING, e um aceite concorrente que perca a corrida
    // lança ConcurrentStatusChangeError antes desta linha. Conflito de agenda e
    // duração ausente também abortam antes. Nunca lança nem bloqueia o aceite.
    // O destinatário (tutor) é resolvido server-side a partir da request.
    await notifyRequestAccepted(requestId)

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")
    revalidatePath(`/tutor/requests/${requestId}`)
    revalidatePath(`/requests/${requestId}`)

    return { success: true, data: updated }
  } catch (err) {
    if (err instanceof ConcurrentStatusChangeError) {
      return { success: false, error: CONCURRENT_UPDATE_MESSAGE }
    }
    // Conflito de agenda: a transação inteira foi abortada, nada foi gravado.
    // Log sem PII — só o id técnico da request e o do compromisso ocupado,
    // que pertencem à agenda do próprio profissional.
    if (err instanceof AgendaConflictError) {
      console.info("[acceptServiceRequestAction] conflito de agenda", {
        requestId,
        conflitaCom: err.conflict.conflictingRequestId,
      })
      return { success: false, error: AGENDA_CONFLICT_MESSAGE }
    }
    // Serviço sem duração confiável para uma request COM horário. Transação
    // abortada, nada gravado. Log sem PII — só ids técnicos do próprio
    // profissional e o tipo de serviço.
    if (err instanceof ServiceDurationRequiredError) {
      console.info("[acceptServiceRequestAction] duracao de servico ausente", {
        requestId,
        serviceType: err.serviceType,
      })
      return { success: false, error: SERVICE_DURATION_REQUIRED_MESSAGE }
    }
    // Qualquer outra falha — incluindo erro ao adquirir o advisory lock da
    // agenda ou timeout da transação — cai aqui como erro interno. Nunca é
    // convertida em mensagem de conflito: dizer "conflito de horário" quando
    // o banco falhou seria mentir sobre a causa e levaria o profissional a
    // mexer na agenda em vez de tentar de novo.
    console.error("[acceptServiceRequestAction]", err)
    return { success: false, error: "Erro interno ao aceitar solicitação." }
  }
}

/**
 * Rejeita uma solicitação. Apenas profissionais. PENDING → CANCELLED_BY_PROFESSIONAL.
 *
 * Trust impact: CANCELLATION_BY_PRO (-2.0)
 * Semântica: "rejeição" é uma recusa antes de assumir o compromisso.
 * Impacto menor que cancelar após aceitar.
 */
export async function rejectServiceRequestAction(
  requestId: string
): Promise<ActionResult<ServiceRequestData>> {
  return applyTransition({
    requestId,
    toStatus: "CANCELLED_BY_PROFESSIONAL",
    requiredActor: "professional",
    auditAction: "request.rejected",
  })
}

/**
 * Inicia o atendimento. Apenas profissionais. ACCEPTED → IN_PROGRESS.
 *
 * Guardrail antifraude MVP:
 *   Bloqueia o início se já existe uma conclusão recente entre o mesmo par
 *   tutor-profissional nas últimas 24h — evita que um serviço entre em andamento
 *   quando não poderá ser concluído por causa do guardrail de conclusão.
 */
export async function startServiceRequestAction(
  requestId: string
): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, professionalUserId } = ctx

    if (professionalUserId !== session.id) {
      return {
        success: false,
        error: "Apenas o profissional pode realizar esta ação.",
      }
    }

    const toStatus: RequestStatus = "IN_PROGRESS"
    if (!isValidTransition(request.status, toStatus)) {
      return {
        success: false,
        error: `Transição inválida: "${request.status}" → "${toStatus}".`,
      }
    }

    // ── Guardrail operacional: profissional com IN_PROGRESS não pode iniciar ──
    // Bypassável em development via DEV_BYPASS_OPERATIONAL_GUARDRAILS=true (.env.local).
    if (!isDevBypassEnabled("operational")) {
      const busy = await hasInProgressRequestForProfessional(
        request.professionalId,
        requestId
      )
      if (busy) {
        return {
          success: false,
          error:
            "Você já possui um atendimento em andamento. Finalize o atendimento atual antes de iniciar outro.",
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Sem cooldown de 24h por conclusão recente do mesmo par — ver nota em
    // acceptServiceRequestAction. Iniciar um atendimento real nunca é
    // bloqueado por reputação.

    // ── Start-Time Guard: não iniciar antes da janela ─────────────────────────
    // `now` é lido AQUI, imediatamente antes da checagem — não reaproveitado
    // de nenhum valor calculado antes na função. É o mesmo `now` que decide,
    // sem intervalo, então não há sentido em recalcular de novo dentro da
    // transação: nada que outro processo escreva muda o RESULTADO desta
    // comparação (ela depende só de scheduledAt, já lido, e do relógio).
    // Quem protege contra concorrência de STATUS é o guard otimista de
    // transitionStatus (ConcurrentStatusChangeError), inalterado.
    const elegibilidade = resolveServiceStartEligibility({
      scheduledAt: request.scheduledAt,
      scheduledHasTime: request.scheduledHasTime,
      now: new Date(),
    })
    if (!elegibilidade.eligible) {
      return { success: false, error: describeServiceStartBlock(elegibilidade) }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Guardrail operacional: data agendada muito no passado ────────────────
    if (request.scheduledAt) {
      const hoursAgo = (Date.now() - request.scheduledAt.getTime()) / 36e5
      if (hoursAgo > 24) {
        return {
          success: false,
          error:
            "A data agendada já passou. Entre em contato com o tutor para confirmar se o atendimento ainda vai acontecer.",
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const fromStatus = request.status
    const updated = await transitionStatus(requestId, fromStatus, toStatus)

    await recordRequestAudit(
      session.id,
      "request.started",
      requestId,
      { status: fromStatus },
      { status: toStatus }
    )

    // ── Push best-effort — IN_PROGRESS JÁ está persistido acima ──────────────
    // `transitionStatus` só escreve se o status ainda for ACCEPTED, então um
    // início concorrente que perca a corrida lança antes desta linha e não
    // notifica. Nunca lança nem bloqueia o início do atendimento.
    await notifyServiceStarted(requestId)

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")
    revalidatePath(`/tutor/requests/${requestId}`)
    revalidatePath(`/requests/${requestId}`)

    return { success: true, data: updated }
  } catch (err) {
    if (err instanceof ConcurrentStatusChangeError) {
      return { success: false, error: CONCURRENT_UPDATE_MESSAGE }
    }
    console.error("[startServiceRequestAction]", err)
    return { success: false, error: "Erro interno ao iniciar solicitação." }
  }
}

/**
 * Cancela uma solicitação.
 *
 * O estado de destino depende de quem cancela:
 *   - Tutor → CANCELLED_BY_TUTOR
 *   - Profissional → CANCELLED_BY_PROFESSIONAL (com impacto no trust se ACCEPTED)
 *
 * Estados que permitem cancelamento: PENDING, ACCEPTED.
 */
export async function cancelServiceRequestAction(
  requestId: string,
  input?: import("../domain/types").CancelServiceRequestInput
): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, tutorUserId, professionalUserId } = ctx

    // Determina quem está cancelando
    const isTutor = tutorUserId === session.id
    const isProfessional = professionalUserId === session.id

    if (!isTutor && !isProfessional) {
      return { success: false, error: "Você não é participante desta solicitação." }
    }

    const toStatus: RequestStatus = isTutor
      ? "CANCELLED_BY_TUTOR"
      : "CANCELLED_BY_PROFESSIONAL"

    // Valida transição via máquina de estados
    if (!isValidTransition(request.status, toStatus)) {
      return {
        success: false,
        error: `Não é possível cancelar uma solicitação com status "${request.status}".`,
      }
    }

    // Verifica autorização da transição específica
    const authorizedActor = getAuthorizedActor(request.status, toStatus)
    const actorRole = isTutor ? "tutor" : "professional"
    if (authorizedActor !== actorRole && authorizedActor !== "either") {
      return { success: false, error: "Você não tem permissão para esta ação." }
    }

    // TrustEvent se houver
    const trustEventDef = getTrustEventForTransition(request.status, toStatus)
    const trustEvent: TrustEventPayload | undefined = trustEventDef
      ? {
          actorId: professionalUserId, // o profissional sempre é o ator do cancelamento próprio
          targetId: professionalUserId, // e o alvo do impacto reputacional
          type: trustEventDef.type,
          weight: trustEventDef.weight,
          context: {
            requestId,
            serviceType: request.serviceType,
            fromStatus: request.status,
            reason: input?.reason ?? null,
          },
          relatedRequestId: requestId,
        }
      : undefined

    const fromStatus = request.status
    const updated = await transitionStatus(requestId, fromStatus, toStatus, { trustEvent })

    await recordRequestAudit(
      session.id,
      isTutor ? "request.cancelled_by_tutor" : "request.cancelled_by_professional",
      requestId,
      { status: fromStatus },
      { status: toStatus }
    )

    // ── Push best-effort — o cancelamento JÁ está persistido acima ───────────
    // Destinatário é sempre a OUTRA parte: quem cancelou não precisa ser
    // avisado do próprio ato. O ator vem do status de destino calculado no
    // servidor, nunca do client.
    await notifyRequestCancelled(requestId, isTutor ? "tutor" : "professional")

    // Recalcula Trust Score se cancelamento do profissional gerou TrustEvent (falha silenciosa)
    if (trustEvent) {
      await updateProfessionalTrust(request.professionalId)
    }

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")
    revalidatePath(`/tutor/requests/${requestId}`)
    revalidatePath(`/requests/${requestId}`)

    return { success: true, data: updated }
  } catch (err) {
    if (err instanceof ConcurrentStatusChangeError) {
      return { success: false, error: CONCURRENT_UPDATE_MESSAGE }
    }
    console.error("[cancelServiceRequestAction]", err)
    return { success: false, error: "Erro interno ao cancelar solicitação." }
  }
}

/**
 * Conclui um atendimento. Apenas profissionais.
 * Estados de origem permitidos: ACCEPTED, IN_PROGRESS.
 *
 * Efeitos ao concluir:
 *   1. Status → COMPLETED, completedAt = now()
 *   2. nextScheduledAt registrado (hint para CRM e sugestão de recorrência)
 *   3. Se isRecurring: emite TrustEvent RECURRENCE_COMPLETED (+1.5)
 *      — o Trust Engine acumula estes eventos para construir o score de recorrência
 *
 * Recorrência (Fase 4):
 *   - Não cria automaticamente o próximo request
 *   - O CRM Module lê completedAt + nextScheduledAt para sugerir o próximo agendamento
 *   - O Ranking Engine usa a contagem de RECURRENCE_COMPLETED para bônus contextual
 */
export async function completeServiceRequestAction(
  requestId: string,
  input?: import("../domain/types").CompleteServiceRequestInput
): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, tutorUserId, professionalUserId } = ctx

    // Apenas profissional conclui
    if (professionalUserId !== session.id) {
      return {
        success: false,
        error: "Apenas o profissional pode marcar a solicitação como concluída.",
      }
    }

    // Valida que o status atual permite conclusão
    const toStatus: RequestStatus = "COMPLETED"
    if (!isValidTransition(request.status, toStatus)) {
      return {
        success: false,
        error: `Não é possível concluir uma solicitação com status "${request.status}".`,
      }
    }

    // Concluir um atendimento real NUNCA é bloqueado por conclusão recente do
    // mesmo par — a conclusão é registrada normalmente, entra no histórico e
    // continua visível para detectArtificialRecurrence. O que a janela de 24h
    // controla agora é só a ELEGIBILIDADE do crédito reputacional abaixo.

    // TrustEvent de recorrência (apenas se isRecurring com histórico)
    let trustEvent: TrustEventPayload | undefined

    if (request.isRecurring) {
      // Elegibilidade reputacional: no máximo um crédito RECURRENCE_COMPLETED
      // por par tutor-profissional dentro da janela. Consulta o TrustEvent
      // (o que de fato já foi creditado), nunca a conclusão bruta — uma
      // conclusão não recorrente jamais emitiu este evento, então tratá-la
      // como "já creditada" seria falso. A conclusão em si acontece
      // normalmente em qualquer caso.
      const eligible = await isRecurrenceCreditEligible({
        actorUserId: tutorUserId,
        targetUserId: professionalUserId,
        windowHours: REPUTATION_CREDIT_WINDOW_HOURS,
      })

      if (eligible) {
        // Conta quantos atendimentos concluídos já existem entre estes dois (antes deste)
        const completedCount = await countCompletedRequestsBetween(
          request.tutorId,
          request.professionalId
        )

        // RECURRENCE_COMPLETED: o ator é o tutor (quem retornou)
        // O alvo é o profissional (quem recebe o crédito reputacional)
        // Peso base: 1.5 — pode ser amplificado pelo Trust Engine com base em completedCount
        trustEvent = {
          actorId: tutorUserId,
          targetId: professionalUserId,
          type: "RECURRENCE_COMPLETED",
          weight: 1.5,
          context: {
            requestId,
            serviceType: request.serviceType,
            seriesId: request.seriesId,
            completedCountInSeries: completedCount + 1, // inclui este
            petId: request.petId,
          },
          relatedRequestId: requestId,
        }
      } else {
        // Sem crédito desta vez — mas a conclusão segue registrada, o
        // relacionamento segue atualizado e o antifraude segue contando.
        console.info("[completeServiceRequestAction] recurrence credit skipped", {
          requestId,
        })
      }
    }

    const parsed = CompleteServiceRequestSchema.safeParse(input ?? {})
    const nextScheduledAt = parsed.success ? parsed.data.nextScheduledAt : undefined

    const fromStatus = request.status

    // ── DENTRO DA TRANSAÇÃO (tudo ou nada) ───────────────────────────────────
    // status → COMPLETED (com o guard otimista por fromStatus), completedAt,
    // TrustEvent de recorrência quando elegível, e o incremento + derivados do
    // relacionamento. Antes, o relacionamento era atualizado FORA da transação
    // e com o erro engolido — uma falha ali deixava a request COMPLETED com o
    // contador defasado para sempre, silenciosamente.
    const updated = await completeServiceRequestAtomic({
      requestId,
      fromStatus,
      tutorId: request.tutorId,
      professionalId: request.professionalId,
      trustEvent,
      nextScheduledAt,
    })

    // ── DEPOIS DO COMMIT ─────────────────────────────────────────────────────
    // Nada daqui para baixo é necessário para a consistência do
    // relacionamento: se qualquer um falhar, request e relacionamento já estão
    // corretos e a reconciliação (scripts/reconcile-relationships.mjs) detecta
    // e corrige qualquer resíduo. Dois deles PRECISAM do estado commitado —
    // updateProfessionalTrust e detectArtificialRecurrence leem as conclusões
    // já gravadas.

    // Best-effort por contrato do módulo: auditoria nunca quebra o fluxo
    // principal (ver infrastructure/audit.ts). Por isso fica fora da
    // transação — colocá-la dentro faria uma falha de auditoria reverter uma
    // conclusão legítima, o que seria pior do que perder o registro.
    await recordRequestAudit(
      session.id,
      "request.completed",
      requestId,
      { status: fromStatus },
      { status: toStatus }
    )

    // ── Push best-effort — DEPOIS do commit de completeServiceRequestAtomic ──
    // A conclusão e o relacionamento já estão gravados; uma falha aqui não
    // reverte nada e não impede Trust nem a detecção de recorrência abaixo.
    await notifyServiceCompleted(requestId)

    // Funil de convite — SERVICE_COMPLETED. Atribuído ao TUTOR da request
    // (`tutorUserId`), não a `session.id`: quem conclui é o profissional, e a
    // visita pertence ao tutor que chegou pela landing. Mesma trava de
    // profissional da etapa de Request. NÃO toca Trust nem gera bônus algum.
    await trackInviteServiceCompleted(tutorUserId, request.professionalId)

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")
    revalidatePath(`/tutor/requests/${requestId}`)
    revalidatePath(`/requests/${requestId}`)

    // Recalcula Trust Score após a conclusão. Falha silenciosa por design —
    // mas agora logada de forma estruturada, para não sumir sem rastro.
    try {
      await updateProfessionalTrust(request.professionalId)
    } catch (err) {
      console.error("[completeServiceRequestAction] pos-commit falhou", {
        requestId,
        etapa: "updateProfessionalTrust",
        erro: String(err),
      })
    }

    // Detector passivo de recorrência artificial — não bloqueia.
    detectArtificialRecurrence(
      request.tutorId,
      request.professionalId,
      professionalUserId
    ).catch((err) => {
      console.error("[completeServiceRequestAction] pos-commit falhou", {
        requestId,
        etapa: "detectArtificialRecurrence",
        erro: String(err),
      })
      return null
    })

    return { success: true, data: updated }
  } catch (err) {
    if (err instanceof ConcurrentStatusChangeError) {
      return { success: false, error: CONCURRENT_UPDATE_MESSAGE }
    }
    // Falha na transação de conclusão: nada foi gravado — nem status, nem
    // relacionamento, nem TrustEvent. Log estruturado sem PII.
    console.error("[completeServiceRequestAction] transacao de conclusao falhou", {
      requestId,
      etapa: "completeServiceRequestAtomic",
      erro: String(err),
    })
    return { success: false, error: "Erro interno ao concluir solicitação." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna os requests do tutor autenticado, com dados dos participantes.
 */
export async function getMyRequestsAsTutorAction(filters?: {
  status?: RequestStatus
  limit?: number
  offset?: number
}): Promise<ActionResult<ServiceRequestWithParticipants[]>> {
  try {
    const session = await requireAuth()

    const tutorProfile = await findTutorProfileByUserId(session.id)
    if (!tutorProfile) return { success: true, data: [] }

    const requests = await findServiceRequestsByTutorId(tutorProfile.id, filters)
    const synced = await syncExpiredPendingRequests(requests)
    return { success: true, data: synced }
  } catch (err) {
    console.error("[getMyRequestsAsTutorAction]", err)
    return { success: false, error: "Erro ao buscar solicitações." }
  }
}

/**
 * Retorna os requests do profissional autenticado, com dados dos participantes.
 */
export async function getMyRequestsAsProfessionalAction(filters?: {
  status?: RequestStatus
  limit?: number
  offset?: number
}): Promise<ActionResult<ServiceRequestWithParticipants[]>> {
  try {
    const session = await requireAuth()

    const professionalProfile = await findProfessionalProfileByUserId(session.id)
    if (!professionalProfile) return { success: true, data: [] }

    const requests = await findServiceRequestsByProfessionalId(
      professionalProfile.id,
      filters
    )
    const synced = await syncExpiredPendingRequests(requests)
    return { success: true, data: synced }
  } catch (err) {
    console.error("[getMyRequestsAsProfessionalAction]", err)
    return { success: false, error: "Erro ao buscar solicitações." }
  }
}

/**
 * Retorna o detalhe de um request, verificando que o usuário é participante.
 */
export async function getServiceRequestDetailAction(
  requestId: string
): Promise<ActionResult<ServiceRequestWithParticipants>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { tutorUserId, professionalUserId } = ctx
    if (tutorUserId !== session.id && professionalUserId !== session.id) {
      return { success: false, error: "Acesso negado." }
    }

    const detail = await findServiceRequestWithParticipants(requestId)
    if (!detail) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const synced = await syncExpiredPendingRequest(detail)
    return { success: true, data: synced }
  } catch (err) {
    console.error("[getServiceRequestDetailAction]", err)
    return { success: false, error: "Erro ao buscar solicitação." }
  }
}

/**
 * Probe de auto-sync (R2B.2 hardening) — leitura mínima e autorizada, sem
 * PII, usada por ActiveRequestAutoRefresh para decidir SE vale chamar
 * `router.refresh()`, em vez de chamá-lo cegamente a cada timer/foco.
 *
 * Mesma autorização de getServiceRequestDetailAction (autenticação +
 * ownership via findRequestWithOwnershipContext), mas devolve só um token
 * comparável — não o detalhe completo (nome, telefone, endereço do outro
 * participante) que a tela já tem e não precisa re-buscar a cada ciclo.
 */
export async function getRequestSyncProbeAction(
  requestId: string
): Promise<ActionResult<{ token: string }>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { tutorUserId, professionalUserId } = ctx
    if (tutorUserId !== session.id && professionalUserId !== session.id) {
      return { success: false, error: "Acesso negado." }
    }

    const snapshot = await getRequestSyncSnapshot(requestId)
    if (!snapshot) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    return { success: true, data: { token: buildRequestSyncToken(snapshot) } }
  } catch (err) {
    console.error("[getRequestSyncProbeAction]", err)
    return { success: false, error: "Erro ao verificar atualização." }
  }
}

/**
 * Probe de LISTA (REQUEST AUTO-SYNC RELIABILITY) — mesma ideia de
 * `getRequestSyncProbeAction`, mas para `/tutor/requests` e o dashboard do
 * tutor: um token agregado das requests NÃO terminais do tutor autenticado,
 * sem payload. Sem perfil de tutor, devolve token vazio — lista vazia é um
 * estado estável, não um erro.
 */
export async function getTutorRequestListSyncProbeAction(): Promise<
  ActionResult<{ token: string }>
> {
  try {
    const session = await requireAuth()
    const tutorProfile = await findTutorProfileByUserId(session.id)
    if (!tutorProfile) return { success: true, data: { token: "" } }

    const snapshot = await getTutorRequestListSyncSnapshot(tutorProfile.id)
    return { success: true, data: { token: buildRequestListSyncToken(snapshot) } }
  } catch (err) {
    console.error("[getTutorRequestListSyncProbeAction]", err)
    return { success: false, error: "Erro ao verificar atualização." }
  }
}

/**
 * Mesmo probe de lista, para `/requests` e o dashboard do profissional.
 */
export async function getProfessionalRequestListSyncProbeAction(): Promise<
  ActionResult<{ token: string }>
> {
  try {
    const session = await requireAuth()
    const professionalProfile = await findProfessionalProfileByUserId(session.id)
    if (!professionalProfile) return { success: true, data: { token: "" } }

    const snapshot = await getProfessionalRequestListSyncSnapshot(professionalProfile.id)
    return { success: true, data: { token: buildRequestListSyncToken(snapshot) } }
  } catch (err) {
    console.error("[getProfessionalRequestListSyncProbeAction]", err)
    return { success: false, error: "Erro ao verificar atualização." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER INTERNO — applyTransition
//
// Centraliza o padrão de transição para ações simples (accept, reject, start)
// Reutiliza a máquina de estados para autorização + validação
// ─────────────────────────────────────────────────────────────────────────────

async function applyTransition({
  requestId,
  toStatus,
  requiredActor,
  auditAction,
}: {
  requestId: string
  toStatus: RequestStatus
  requiredActor: "tutor" | "professional"
  auditAction: string
}): Promise<ActionResult<ServiceRequestData>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const { request, tutorUserId, professionalUserId } = ctx

    // Verifica ownership pelo papel requerido
    const actorUserId =
      requiredActor === "professional" ? professionalUserId : tutorUserId
    if (actorUserId !== session.id) {
      return {
        success: false,
        error:
          requiredActor === "professional"
            ? "Apenas o profissional pode realizar esta ação."
            : "Apenas o tutor pode realizar esta ação.",
      }
    }

    // Valida transição via máquina de estados (dados)
    if (!isValidTransition(request.status, toStatus)) {
      return {
        success: false,
        error: `Transição inválida: "${request.status}" → "${toStatus}".`,
      }
    }

    // Verifica ator autorizado (dados)
    const authorizedActor = getAuthorizedActor(request.status, toStatus)
    if (
      authorizedActor !== requiredActor &&
      authorizedActor !== "either"
    ) {
      return { success: false, error: "Você não tem permissão para esta transição." }
    }

    // TrustEvent se houver definição para esta transição (dados)
    const trustEventDef = getTrustEventForTransition(request.status, toStatus)
    const trustEvent: TrustEventPayload | undefined = trustEventDef
      ? {
          actorId: professionalUserId,
          targetId: professionalUserId,
          type: trustEventDef.type,
          weight: trustEventDef.weight,
          context: {
            requestId,
            serviceType: request.serviceType,
            fromStatus: request.status,
          },
          relatedRequestId: requestId,
        }
      : undefined

    const fromStatus = request.status
    const updated = await transitionStatus(requestId, fromStatus, toStatus, { trustEvent })

    await recordRequestAudit(
      session.id,
      auditAction,
      requestId,
      { status: fromStatus },
      { status: toStatus }
    )

    // Recalcula Trust Score se a transição gerou TrustEvent (falha silenciosa)
    if (trustEvent) {
      await updateProfessionalTrust(request.professionalId)
    }

    revalidatePath("/tutor/requests")
    revalidatePath("/tutor")
    revalidatePath("/requests")
    revalidatePath(`/tutor/requests/${requestId}`)
    revalidatePath(`/requests/${requestId}`)

    return { success: true, data: updated }
  } catch (err) {
    if (err instanceof ConcurrentStatusChangeError) {
      return { success: false, error: CONCURRENT_UPDATE_MESSAGE }
    }
    console.error(`[applyTransition ${toStatus}]`, err)
    return { success: false, error: "Erro interno ao processar a solicitação." }
  }
}
