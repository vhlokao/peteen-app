/**
 * Módulo: notifications
 * Camada: domain — quais eventos de lifecycle a central in-app mostra ao
 * tutor, quando cada um aconteceu, e qual copy cada um usa (R2B.3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO SAIU DE queries.ts
 *
 * A central é derivada: ela não tem tabela de notificações, ela LÊ o domínio e
 * infere o que aconteceu. Isso é bom (nada a sincronizar, nada a migrar), mas
 * tem um risco próprio — inferir errado. Foi o que aconteceu: a condição era
 * `["ACCEPTED","IN_PROGRESS","COMPLETED"].includes(status)` datada por
 * `updatedAt`, então ao INICIAR ou CONCLUIR o tutor recebia "Fulano aceitou sua
 * solicitação" carimbado de agora — a copy de um evento antigo no lugar do
 * evento real.
 *
 * A regra de inferência agora é uma função pura, testável sem banco: recebe os
 * FATOS temporais da request e devolve os eventos que de fato ocorreram, cada
 * um com o seu instante. `queries.ts` continua responsável por buscar os fatos
 * e montar href/nome — mas não decide mais o que aconteceu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE ONDE VEM CADA INSTANTE
 *
 *   started   → ServiceRequest.startedAt    (coluna, gravada na transição)
 *   completed → ServiceRequest.completedAt  (coluna, gravada na transição)
 *   accepted  → AuditLog "request.accepted" (não existe coluna acceptedAt)
 *   cancelled → updatedAt (cancelado é terminal: nada move o timestamp depois)
 *
 * `updatedAt` só é aceito onde o estado atual PROVA que a última escrita foi
 * aquele evento. Em qualquer outro caso preferimos omitir a notificação a
 * datá-la errado — o histórico se reconstrói pelos eventos que têm instante
 * confiável.
 */

/** Eventos de lifecycle que o TUTOR vê. Início e conclusão são do profissional. */
export type TutorLifecycleEventKind =
  | "accepted"
  | "started"
  | "completed"
  | "cancelled_by_professional"

export type TutorLifecycleEvent = {
  kind: TutorLifecycleEventKind
  at: Date
}

export type TutorLifecycleFacts = {
  status: string
  createdAt: Date
  updatedAt: Date
  /** AuditLog "request.accepted". null quando a request é anterior à auditoria. */
  acceptedAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
}

/**
 * Margem para o fallback de aceite. Uma request recém-criada tem
 * `updatedAt ≈ createdAt`; sem esta folga, qualquer escrita incidental logo
 * após a criação viraria um "aceite" datado de agora. Só se aplica ao
 * fallback — quando existe AuditLog, o instante é exato e a margem é
 * irrelevante.
 */
export const ACCEPT_FALLBACK_MIN_DELTA_MS = 60_000

/**
 * Eventos realmente ocorridos, dentro da janela `since`, em ordem cronológica.
 *
 * Uma request COMPLETED devolve os três eventos (aceite, início, conclusão),
 * cada um no seu instante — é assim que o tutor reconstrói o que aconteceu ao
 * voltar ao app depois. Não é redundância: são fatos distintos.
 */
export function deriveTutorLifecycleEvents(
  facts: TutorLifecycleFacts,
  since: Date
): TutorLifecycleEvent[] {
  const eventos: TutorLifecycleEvent[] = []

  // ── Aceite ────────────────────────────────────────────────────────────────
  // Com AuditLog, instante exato. Sem AuditLog, só inferimos quando o estado
  // ATUAL é ACCEPTED — aí `updatedAt` é comprovadamente o aceite. Em
  // IN_PROGRESS/COMPLETED sem AuditLog, omitimos: era exatamente esse caminho
  // que produzia a copy de aceite com data errada.
  const acceptedAt =
    facts.acceptedAt ??
    (facts.status === "ACCEPTED" &&
    facts.updatedAt.getTime() > facts.createdAt.getTime() + ACCEPT_FALLBACK_MIN_DELTA_MS
      ? facts.updatedAt
      : null)

  if (acceptedAt && acceptedAt >= since) {
    eventos.push({ kind: "accepted", at: acceptedAt })
  }

  // ── Início e conclusão — colunas próprias, sempre confiáveis ──────────────
  if (facts.startedAt && facts.startedAt >= since) {
    eventos.push({ kind: "started", at: facts.startedAt })
  }
  if (facts.completedAt && facts.completedAt >= since) {
    eventos.push({ kind: "completed", at: facts.completedAt })
  }

  // ── Cancelamento pelo profissional ────────────────────────────────────────
  // O espelho disto (tutor cancela → profissional é avisado) já existia; o
  // lado do tutor não. Terminal, então `updatedAt` é fiel.
  if (facts.status === "CANCELLED_BY_PROFESSIONAL" && facts.updatedAt >= since) {
    eventos.push({ kind: "cancelled_by_professional", at: facts.updatedAt })
  }

  return eventos.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/**
 * Copy da central in-app. Mais rica que a do push por contrato: ler a central
 * exige sessão, a lockscreen não. Só `accepted` usa o nome do profissional —
 * é o único evento em que quem agiu é informação útil e ainda não conhecida.
 *
 * Cada kind tem frase PRÓPRIA. É o contrato do item 14: nenhum estado pode
 * reaproveitar a frase de outro.
 */
export function tutorLifecycleCopy(
  kind: TutorLifecycleEventKind,
  professionalName: string
): { title: string; description: string } {
  switch (kind) {
    case "accepted":
      return {
        title: "Solicitação aceita",
        description: `${professionalName} aceitou sua solicitação.`,
      }
    case "started":
      return {
        title: "Atendimento iniciado",
        description: "O atendimento foi iniciado.",
      }
    case "completed":
      return {
        title: "Atendimento concluído",
        description: "O atendimento foi concluído.",
      }
    case "cancelled_by_professional":
      return {
        title: "Solicitação cancelada",
        description: "O profissional cancelou a solicitação.",
      }
  }
}
