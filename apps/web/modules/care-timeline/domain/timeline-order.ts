/**
 * Módulo: care-timeline
 * Camada: domain — ordem canônica de LEITURA do Diário.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE MUDOU E POR QUÊ
 *
 * Achado físico: durante um atendimento real, a atualização mais recente
 * aparecia no FIM da lista. Para acompanhar um cuidado em andamento — o caso
 * de uso central do Diário — quem lê quer a última notícia primeiro, não
 * precisa rolar até o fundo para saber o que acabou de acontecer.
 *
 * A ordem passa a ser MAIS RECENTE PRIMEIRO, por `occurredAt` — não por
 * `createdAt`. São coisas diferentes: um profissional pode publicar às 21:20
 * um evento que ocorreu às 21:00, depois de já ter publicado, às 21:10, um
 * evento que ocorreu às 21:10. A ordem correta de leitura é 21:10 → 21:00,
 * porque é isso que representa a sequência real do cuidado — mesmo que o
 * registro das 21:00 tenha entrado no banco DEPOIS do das 21:10.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTA É A ÚNICA FONTE DA REGRA — infra e domínio não podem divergir
 *
 * `getCareTimeline` (infrastructure/repository.ts) busca as linhas do banco e
 * ORDENA COM ESTA MESMA FUNÇÃO, em vez de replicar a regra como uma cláusula
 * `orderBy` do Prisma. Duas implementações da "mesma" ordem — uma em SQL, outra
 * em JS — são exatamente o tipo de duplicação que diverge silenciosamente
 * quando alguém mexe em uma e esquece a outra. Como o volume de atualizações
 * por atendimento é pequeno (dezenas, não milhares), ordenar em memória depois
 * de uma busca sem `orderBy` custa nada e elimina esse risco por construção: só
 * existe UM lugar que decide a ordem, e é testável sem banco.
 *
 * Não altera o que está persistido — `occurredAt`, `createdAt` e a ordem de
 * INSERÇÃO no banco continuam exatamente como sempre foram. Isto é só a
 * projeção de LEITURA.
 */

export type TimelineOrderable = {
  id: string
  occurredAt: Date
  createdAt: Date
}

/**
 * Comparador para `Array.prototype.sort` — mais recente primeiro.
 *
 * Critério: `occurredAt` DESC → `createdAt` DESC → `id` DESC. Os dois últimos
 * são desempate determinístico: sem eles, dois registros com o mesmíssimo
 * `occurredAt` (dois eventos que a pessoa marcou como tendo acontecido no
 * mesmo minuto) apareceriam em ordem que poderia variar entre carregamentos —
 * `Array.prototype.sort` não garante estabilidade entre motores JS para
 * comparadores que devolvem 0 de formas diferentes a cada chamada, e depender
 * disso seria um bug latente. `id` como último critério é sempre distinto
 * (chave primária), então a ordem final é sempre a mesma para o mesmo conjunto
 * de dados.
 */
export function compareTimelineNewestFirst(a: TimelineOrderable, b: TimelineOrderable): number {
  const porOccurredAt = b.occurredAt.getTime() - a.occurredAt.getTime()
  if (porOccurredAt !== 0) return porOccurredAt

  const porCreatedAt = b.createdAt.getTime() - a.createdAt.getTime()
  if (porCreatedAt !== 0) return porCreatedAt

  if (a.id === b.id) return 0
  return a.id < b.id ? 1 : -1
}

/**
 * Ordena uma lista de atualizações — mais recente primeiro. Não muta o array
 * recebido (retorna uma cópia), para que o chamador nunca precise se perguntar
 * se a referência original ainda está na ordem que tinha antes.
 */
export function sortCareUpdatesNewestFirst<T extends TimelineOrderable>(updates: T[]): T[] {
  return [...updates].sort(compareTimelineNewestFirst)
}

/**
 * Quais atualizações o RESUMO (CareTimelineSummary) mostra.
 *
 * Pré-condição: `updates` já vem newest-first — é o contrato de
 * `getCareTimeline`. Esta função não reordena; só recorta. Extraída para cá
 * (em vez de viver inline no componente) porque é exatamente o tipo de decisão
 * — "quais N desta lista aparecem?" — que este projeto testa sem DOM, e a
 * versão anterior (`updates.slice(-max).reverse()`) só fazia sentido enquanto
 * a lista chegava oldest-first; deixar essa suposição implícita dentro do
 * componente é o tipo de acoplamento que quebra em silêncio quando a ordem de
 * origem muda — como aconteceu aqui.
 */
export function selectTimelineSummary<T extends TimelineOrderable>(
  updatesNewestFirst: T[],
  max: number
): T[] {
  return updatesNewestFirst.slice(0, max)
}
