/**
 * Módulo: backoffice
 * Camada: domain — TIMELINE OPERACIONAL de uma solicitação.
 *
 * Função pura. Recebe fatos de quatro tabelas e devolve uma sequência ordenada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ELA RESOLVE
 *
 * Reconstruir um incidente exigia abrir cinco superfícies: a Request, o
 * AuditLog, a Care Timeline, `push_deliveries` e o banco na mão. Nenhuma delas
 * responde sozinha "o que aconteceu, em que ordem" — e é essa a única pergunta
 * que a triagem faz.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISTO NÃO É A CARE TIMELINE DO TUTOR
 *
 * A Care Timeline é o Diário: conteúdo de cuidado, escrito para o tutor ler,
 * com foto e texto. Esta timeline é um LOG OPERACIONAL: quando cada coisa
 * aconteceu e o que o sistema fez a respeito.
 *
 * Por isso um CareUpdate entra aqui como MARCADOR — "atualização publicada",
 * com horário, autor e categoria — e nunca com o `content`. Não é só
 * privacidade (embora seja também: conteúdo de Diário pode ter saúde,
 * medicação, rotina da casa): é que despejar o texto aqui transformaria o log
 * de incidente num segundo Diário pior que o original. O conteúdo continua
 * onde sempre esteve, na inspeção dedicada da Care Timeline, logo abaixo na
 * mesma página.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export const OPERATIONAL_SOURCES = [
  "ServiceRequest",
  "CareUpdate",
  "PushDelivery",
  "AuditLog",
  "Dispute",
] as const

export type OperationalSource = (typeof OPERATIONAL_SOURCES)[number]

export type OperationalEvent = {
  at: Date
  fonte: OperationalSource
  titulo: string
  /** Complemento factual. Nunca conteúdo de Diário. */
  detalhe: string | null
  /**
   * Merece destaque na triagem: falha de push acionável, disputa aberta,
   * cancelamento. Não é "erro" — é "olhe para isto primeiro".
   */
  atencao: boolean
}

export type TimelineInput = {
  request: {
    createdAt: Date
    startedAt: Date | null
    completedAt: Date | null
    status: string
    /** Quando a Request saiu de PENDING sem interação, ou foi cancelada. */
    updatedAt: Date
  }
  careUpdates: Array<{
    createdAt: Date
    occurredAt: Date
    category: string
    authorName: string | null
    editedAt: Date | null
    deletedAt: Date | null
    mediaCount: number
  }>
  pushes: Array<{
    createdAt: Date
    eventType: string
    recipientLabel: string
    outcomeLabel: string
    atencao: boolean
  }>
  auditLogs: Array<{
    createdAt: Date
    action: string
    actorLabel: string | null
  }>
  disputes: Array<{
    createdAt: Date
    resolvedAt: Date | null
    reason: string
    status: string
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Montagem
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prioridade de desempate quando dois eventos têm o MESMO instante.
 *
 * Acontece de verdade e não é raro: a Request é criada e o push é despachado
 * dentro da mesma Server Action, os dois com timestamp do mesmo segundo. Sem
 * uma ordem estável, a leitura sugeriria que o aviso saiu antes do fato que o
 * originou — que é justamente a conclusão errada numa investigação.
 *
 * A ordem segue a causalidade real: o fato de domínio primeiro, depois o que
 * o sistema fez por causa dele.
 */
const PRIORIDADE: Record<OperationalSource, number> = {
  ServiceRequest: 0,
  CareUpdate: 1,
  Dispute: 2,
  AuditLog: 3,
  PushDelivery: 4,
}

const STATUS_TERMINAL_LABEL: Record<string, string> = {
  COMPLETED: "Atendimento concluído",
  CANCELLED_BY_TUTOR: "Cancelado pelo tutor",
  CANCELLED_BY_PROFESSIONAL: "Cancelado pelo profissional",
  EXPIRED: "Expirou sem resposta",
  DISPUTED: "Entrou em disputa",
}

/** Terminais que pedem destaque — os que representam um desfecho ruim. */
const TERMINAL_COM_ATENCAO = new Set([
  "CANCELLED_BY_TUTOR",
  "CANCELLED_BY_PROFESSIONAL",
  "EXPIRED",
  "DISPUTED",
])

export function montarTimelineOperacional(input: TimelineInput): OperationalEvent[] {
  const eventos: OperationalEvent[] = []

  // ── Ciclo de vida da Request ─────────────────────────────────────────────
  eventos.push({
    at: input.request.createdAt,
    fonte: "ServiceRequest",
    titulo: "Solicitação criada",
    detalhe: null,
    atencao: false,
  })

  if (input.request.startedAt) {
    eventos.push({
      at: input.request.startedAt,
      fonte: "ServiceRequest",
      titulo: "Atendimento iniciado",
      detalhe: null,
      atencao: false,
    })
  }

  if (input.request.completedAt) {
    eventos.push({
      at: input.request.completedAt,
      fonte: "ServiceRequest",
      titulo: "Atendimento concluído",
      detalhe: null,
      atencao: false,
    })
  }

  // Terminais SEM carimbo próprio (cancelamento, expiração) só têm
  // `updatedAt` como instante. Reconstruímos a partir dele — e o rótulo diz
  // qual foi o desfecho, que é a informação que falta na investigação.
  //
  // COMPLETED é pulado aqui: já entrou acima com `completedAt`, que é o
  // instante correto; usar `updatedAt` duplicaria a linha e ainda por cima com
  // horário potencialmente diferente (uma avaliação posterior mexe em
  // `updatedAt`).
  const rotuloTerminal = STATUS_TERMINAL_LABEL[input.request.status]
  if (rotuloTerminal && input.request.status !== "COMPLETED") {
    eventos.push({
      at: input.request.updatedAt,
      fonte: "ServiceRequest",
      titulo: rotuloTerminal,
      // Honestidade sobre a precisão: para estes estados não existe carimbo
      // dedicado, e `updatedAt` é o melhor instante disponível. Dizer isso
      // evita que alguém trate o horário como exato numa disputa.
      detalhe: "Instante aproximado (última atualização do registro)",
      atencao: TERMINAL_COM_ATENCAO.has(input.request.status),
    })
  }

  // ── Care Timeline — MARCADORES, nunca conteúdo ───────────────────────────
  for (const u of input.careUpdates) {
    const partes: string[] = [u.category]
    if (u.authorName) partes.push(u.authorName)
    if (u.mediaCount > 0) partes.push(`${u.mediaCount} mídia(s)`)
    // `occurredAt` divergente é fato operacional relevante: o profissional
    // registrou algo que aconteceu em outro horário.
    if (u.occurredAt.getTime() !== u.createdAt.getTime()) {
      partes.push(`ocorrido em ${u.occurredAt.toISOString()}`)
    }
    if (u.editedAt) partes.push("editada")
    if (u.deletedAt) partes.push("excluída")

    eventos.push({
      at: u.createdAt,
      fonte: "CareUpdate",
      titulo: u.deletedAt ? "Atualização do Diário (excluída)" : "Atualização do Diário",
      detalhe: partes.join(" · "),
      atencao: false,
    })
  }

  // ── Push ─────────────────────────────────────────────────────────────────
  for (const p of input.pushes) {
    eventos.push({
      at: p.createdAt,
      fonte: "PushDelivery",
      titulo: `Push: ${p.eventType}`,
      detalhe: `${p.recipientLabel} · ${p.outcomeLabel}`,
      atencao: p.atencao,
    })
  }

  // ── AuditLog ─────────────────────────────────────────────────────────────
  for (const a of input.auditLogs) {
    eventos.push({
      at: a.createdAt,
      fonte: "AuditLog",
      titulo: a.action,
      detalhe: a.actorLabel,
      atencao: false,
    })
  }

  // ── Disputas ─────────────────────────────────────────────────────────────
  for (const d of input.disputes) {
    eventos.push({
      at: d.createdAt,
      fonte: "Dispute",
      titulo: "Disputa aberta",
      detalhe: d.reason,
      atencao: true,
    })
    if (d.resolvedAt) {
      eventos.push({
        at: d.resolvedAt,
        fonte: "Dispute",
        titulo: `Disputa encerrada (${d.status})`,
        detalhe: null,
        atencao: false,
      })
    }
  }

  return eventos.sort((a, b) => {
    const dt = a.at.getTime() - b.at.getTime()
    if (dt !== 0) return dt
    return PRIORIDADE[a.fonte] - PRIORIDADE[b.fonte]
  })
}

/** Quantos pontos da timeline pedem atenção. Alimenta o resumo do topo. */
export function contarAtencao(eventos: OperationalEvent[]): number {
  return eventos.filter((e) => e.atencao).length
}
