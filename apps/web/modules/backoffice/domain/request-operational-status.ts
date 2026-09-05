/**
 * Módulo: backoffice
 * Camada: domain — o que uma solicitação REALMENTE é agora, para quem opera
 * (GATE-14-BACKOFFICE-OPERATIONS-CLEANUP-001).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O DEFEITO QUE ESTE ARQUIVO FECHA
 *
 * `EXPIRED` é status PERSISTIDO, mas quem escreve não é o relógio — são dois
 * mecanismos que rodam depois do vencimento:
 *
 *   1. o cron `/api/cron/expire-requests`, que roda **1x por dia** às 09:00
 *      (limite do plano Hobby — está em vercel.json);
 *   2. a sincronização lazy (`syncExpiredPendingRequests`), chamada nas
 *      leituras do TUTOR e do PROFISSIONAL.
 *
 * O Backoffice não passa por nenhum dos dois. A consequência, medida no
 * código: uma solicitação que venceu às 10:00 continua listada como
 * **"Pendente"** para quem opera por até ~23 horas — enquanto o tutor e o
 * profissional já veem **"Expirado"** nas telas deles, e o guard de aceite já
 * recusa a aceitação.
 *
 * Para uma tela de investigação isso é o pior tipo de erro: ela responde com
 * confiança a pergunta errada. Quem está apurando "por que ninguém respondeu
 * esta solicitação?" vê "Pendente" e conclui que ainda dá tempo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE DERIVAR, E NÃO ESCREVER
 *
 * A correção óbvia seria rodar a sincronização lazy também no Backoffice. Ela
 * foi descartada de propósito: abrir uma tela de admin passaria a MUTAR dados
 * de produção, e uma listagem de 300 linhas viraria até 300 escritas por
 * carregamento. Investigar não pode alterar o que está sendo investigado.
 *
 * Então o Backoffice DERIVA para exibir e não escreve nada. O cron e a
 * sincronização lazy continuam sendo os únicos que persistem — nenhuma engine
 * nova, nenhuma migration, nenhum job.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A DIVERGÊNCIA CONTINUA VISÍVEL, DE PROPÓSITO
 *
 * `pendingSync` não é detalhe interno: é informação operacional real. Uma linha
 * marcada assim diz "o banco ainda não sabe disso". Esconder o fato faria a
 * tela mentir na direção oposta — afirmando um `EXPIRED` persistido que não
 * existe, e escondendo que o cron está atrasado ou parado.
 */

import { isRequestExpired } from "../../service-request/domain/request-expiry.ts"

/** O mínimo necessário para decidir. Espelha o que a listagem já carrega. */
export type OperationalStatusShape = {
  status: string
  createdAt: Date
  scheduledAt: Date | null
}

export type OperationalRequestStatus = {
  /** O que está gravado na coluna `status`. */
  persisted: string
  /** O que vale AGORA — é isto que a tela mostra. */
  effective: string
  /**
   * O efetivo diverge do persistido: o vencimento já aconteceu e nenhum dos
   * dois mecanismos de escrita passou por aqui ainda.
   */
  pendingSync: boolean
}

/**
 * Estado operacional de uma solicitação no instante `now`.
 *
 * Só PENDING pode divergir. Nenhum outro status é derivado: `ACCEPTED`,
 * `IN_PROGRESS`, `COMPLETED`, os dois cancelamentos e `DISPUTED` são fatos
 * registrados por uma ação de alguém, e o tempo não os altera. Um `EXPIRED` já
 * persistido também não muda — ele já é o destino final.
 *
 * A regra de vencimento NÃO é reimplementada aqui: `isRequestExpired` é a
 * mesma função que o aceite, o cron e a sincronização lazy usam. Duplicar a
 * conta faria o Backoffice discordar do produto no dia em que a fórmula
 * mudasse — que é exatamente a classe de bug que este gate veio corrigir.
 */
export function resolveOperationalRequestStatus(
  request: OperationalStatusShape,
  now: Date = new Date()
): OperationalRequestStatus {
  if (request.status !== "PENDING") {
    return { persisted: request.status, effective: request.status, pendingSync: false }
  }

  const vencida = isRequestExpired(request.createdAt, request.scheduledAt, now)
  if (!vencida) {
    return { persisted: "PENDING", effective: "PENDING", pendingSync: false }
  }

  return { persisted: "PENDING", effective: "EXPIRED", pendingSync: true }
}

/**
 * Quantas linhas da página estão vencidas sem estar gravadas como tal.
 *
 * Serve à operação, não à estética: um número que cresce e não volta a zero
 * depois das 09:00 é o sinal de que o cron parou — hoje não há nenhum outro
 * alarme para isso, porque a rotina não grava AuditLog (ver o cabeçalho da
 * própria rota, que documenta a lacuna).
 */
export function countPendingSync(
  requests: readonly OperationalStatusShape[],
  now: Date = new Date()
): number {
  return requests.reduce(
    (total, r) => (resolveOperationalRequestStatus(r, now).pendingSync ? total + 1 : total),
    0
  )
}
