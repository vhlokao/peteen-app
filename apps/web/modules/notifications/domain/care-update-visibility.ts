/**
 * Módulo: notifications
 * Camada: domain — visibilidade de um CareUpdate na central de notificações
 * do tutor (microcorreção pós-gate independente, R2B.3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG
 *
 * A query original filtrava por `request.status === "IN_PROGRESS"` — o estado
 * ATUAL da ServiceRequest — para decidir se um CareUpdate aparecia na central.
 * Resultado: um CareUpdate publicado durante o atendimento sumia da lista
 * assim que o profissional concluía, porque `status` já não era mais
 * IN_PROGRESS no momento da leitura. Mesma classe de erro que motivou extrair
 * `deriveTutorLifecycleEvents` — usar o estado ATUAL para decidir a visibilidade
 * de um evento HISTÓRICO que já ocorreu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE A CORREÇÃO É SEGURA (não é só remover uma trava)
 *
 * `publishCareUpdateAction` só permite criar um CareUpdate quando
 * `request.status === "IN_PROGRESS"` no INSTANTE da escrita (guard de domínio
 * em care-timeline/application/actions.ts). E `VALID_TRANSITIONS` só permite
 * `IN_PROGRESS → COMPLETED` — nenhuma aresta para um estado cancelado.
 *
 * Logo a MERA EXISTÊNCIA de uma linha de CareUpdate já prova que ela nasceu
 * legítima, e a request correspondente só pode estar, HOJE, em IN_PROGRESS ou
 * COMPLETED — nunca cancelada. Não há necessidade (nem seria correto) trocar
 * `status === "IN_PROGRESS"` por uma lista arbitrária como
 * `status in ["IN_PROGRESS","COMPLETED"]`: isso reintroduziria o mesmo
 * acoplamento ao estado atual que esta correção remove, só que mascarado. A
 * visibilidade de um CareUpdate não depende de status NENHUM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTA FUNÇÃO DECIDE E O QUE ELA NÃO DECIDE
 *
 * Só os dois fatos do PRÓPRIO CareUpdate que legitimamente mudam com o tempo:
 * soft delete e janela temporal. Ownership (tutorId) é fronteira de segurança
 * e continua exclusivamente no `WHERE` do Prisma — nunca reimplementada aqui,
 * pelo mesmo motivo que autorização não é decisão de domínio testável em
 * isolamento neste projeto.
 *
 * Aplicada em queries.ts como um FILTRO REDUNDANTE (defesa em profundidade)
 * sobre o resultado já escopado por tutorId no banco — o `WHERE` do Prisma
 * continua sendo a fonte de verdade eficiente (evita buscar linhas demais
 * antes do soft-delete/janela); esta função existe para que a REGRA em si
 * seja testável sem banco e para que uma futura edição do `WHERE` que
 * reintroduza um filtro de status seja pega por este filtro adicional antes
 * de virar bug em produção de novo.
 */

export type CareUpdateVisibilityFacts = {
  /** Soft delete — CareUpdate editado/removido não aparece. */
  deletedAt: Date | null
  /** Novidade é definida por createdAt, não por occurredAt (ver queries.ts). */
  createdAt: Date
}

export function isCareUpdateVisibleInNotifications(
  facts: CareUpdateVisibilityFacts,
  since: Date
): boolean {
  if (facts.deletedAt !== null) return false
  return facts.createdAt >= since
}
