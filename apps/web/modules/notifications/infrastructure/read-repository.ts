/**
 * Módulo: notifications
 * Camada: infrastructure — persistência do estado de leitura da central e
 * agregações do probe barato.
 *
 * Toda função aqui recebe `userId` da SESSÃO (nunca do cliente) e filtra por
 * ele — `notification_reads` é por usuário, e o índice único
 * `(userId, notificationKey)` é o que torna a marcação idempotente no banco,
 * não só na aplicação.
 */

import { prisma } from "@/lib/prisma/client"

/**
 * Quais das chaves informadas este usuário já leu.
 *
 * Recebe as chaves do feed já derivado e devolve um Set — a junção acontece
 * em memória (ver domain/read-state.ts). Filtrar por `notificationKey in`
 * mantém a leitura proporcional ao que a tela mostra (≤ 40 chaves), em vez
 * de carregar o histórico inteiro do usuário.
 */
export async function findReadKeys(
  userId: string,
  keys: string[]
): Promise<Set<string>> {
  if (keys.length === 0) return new Set()

  const rows = await prisma.notificationRead.findMany({
    where: { userId, notificationKey: { in: keys } },
    select: { notificationKey: true },
  })

  return new Set(rows.map((row) => row.notificationKey))
}

/**
 * Marca UMA notificação como lida.
 *
 * `createMany + skipDuplicates` em vez de `create`: dois cliques no mesmo
 * item (ou um "marcar todas" concorrente) não podem estourar violação de
 * unique nem duplicar linha. Idempotente por construção — chamar de novo é
 * um no-op silencioso, e `readAt` preserva o instante da PRIMEIRA leitura,
 * que é a informação verdadeira.
 */
export async function markNotificationRead(
  userId: string,
  notificationKey: string
): Promise<void> {
  await prisma.notificationRead.createMany({
    data: [{ userId, notificationKey }],
    skipDuplicates: true,
  })
}

/**
 * Marca um lote como lido — mesma garantia de idempotência.
 * Devolve quantas linhas foram de fato criadas (0 se tudo já estava lido).
 */
export async function markNotificationsRead(
  userId: string,
  notificationKeys: string[]
): Promise<number> {
  if (notificationKeys.length === 0) return 0

  const result = await prisma.notificationRead.createMany({
    data: notificationKeys.map((notificationKey) => ({ userId, notificationKey })),
    skipDuplicates: true,
  })

  return result.count
}

/**
 * Quantas marcações de leitura o usuário tem desde `since`. Entra no token do
 * probe para que marcar como lida (que não altera nenhuma tabela de origem)
 * ainda assim seja detectado como mudança pela outra aba do mesmo usuário.
 */
export async function countReadsSince(userId: string, since: Date): Promise<number> {
  return prisma.notificationRead.count({
    where: { userId, readAt: { gte: since } },
  })
}
