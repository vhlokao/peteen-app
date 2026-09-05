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

import {
  isRequestExpired,
  PENDING_MAX_AGE_HOURS,
  SCHEDULED_SAFETY_MARGIN_HOURS,
} from "../../service-request/domain/request-expiry.ts"

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

// ─────────────────────────────────────────────────────────────────────────────
// FILTRAR pelo estado operacional — GATE-14-...-FIX-002
//
// Exibir o estado derivado e continuar FILTRANDO pela coluna crua produzia duas
// mentiras novas: o filtro `PENDING` devolvia linhas que a própria tabela
// desenhava como `EXPIRED`, e o filtro `EXPIRED` escondia exatamente as PENDING
// vencidas que este gate existe para tornar visíveis.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status cujo valor efetivo depende do RELÓGIO, não só da coluna.
 *
 * São só estes dois. `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, os dois
 * cancelamentos e `DISPUTED` registram um ato de alguém — o tempo não os move,
 * e filtrá-los pela coluna persistida continua sendo exatamente certo.
 */
export const OPERATIONAL_STATUS_FILTERS = ["PENDING", "EXPIRED"] as const

export type OperationalStatusFilter = (typeof OPERATIONAL_STATUS_FILTERS)[number]

export function isOperationalStatusFilter(
  status: string | undefined | null
): status is OperationalStatusFilter {
  return (
    status === "PENDING" ||
    status === "EXPIRED"
  )
}

/**
 * Esta linha pertence ao recorte pedido?
 *
 * Autoridade única de aceitação — a decisão sai de `resolveOperationalRequestStatus`,
 * que por sua vez sai de `isRequestExpired`. Nenhum ramo aqui recalcula prazo.
 */
export function matchesOperationalStatus(
  request: OperationalStatusShape,
  filtro: OperationalStatusFilter,
  now: Date = new Date()
): boolean {
  return resolveOperationalRequestStatus(request, now).effective === filtro
}

/**
 * Limites para o banco PRÉ-SELECIONAR candidatos a PENDING vencida.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO DÁ PARA EXPRESSAR A REGRA EXATA NA QUERY
 *
 * A regra tem um ramo que compara DUAS COLUNAS entre si: quando
 * `scheduledAt - createdAt < 1h`, o prazo passa a ser o próprio `scheduledAt`,
 * sem a margem de segurança. Um `where` de Prisma não compara coluna com
 * coluna, e escrever isso em SQL cru duplicaria a fórmula — que é justamente o
 * que não pode acontecer: no dia em que a regra mudasse, a query discordaria do
 * produto em silêncio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENTÃO O BANCO SÓ AMPLIA, E O DOMÍNIO DECIDE
 *
 * Estes limites formam uma SUPERAPROXIMAÇÃO: toda PENDING realmente vencida
 * satisfaz o predicado, mas o predicado também deixa passar algumas que ainda
 * não venceram. Quem descarta essas é `matchesOperationalStatus`, com a regra
 * real. O banco reduz o volume; ele nunca decide.
 *
 * A prova, caso a caso (`gap = scheduledAt - createdAt`):
 *
 *   sem scheduledAt  vencida ⟺ createdAt ≤ now-24h                  → 1º limite
 *   gap ≥ 1h         vencida ⟺ createdAt ≤ now-24h
 *                              OU scheduledAt ≤ now+1h              → exato
 *   gap < 1h         vencida ⟺ scheduledAt ≤ now
 *                              ⟹ scheduledAt ≤ now+1h               → contido
 *
 * O único falso positivo é a última linha: agendamento marcado para menos de 1h
 * depois da criação e que ainda não chegou. `matchesOperationalStatus` o remove.
 *
 * Há um teste que percorre a matriz e falha se estes limites deixarem de ser
 * superconjunto — porque no dia em que isso acontecer, a tela passará a OMITIR
 * linhas vencidas em silêncio, que é o pior desfecho possível aqui.
 */
export function pendingExpiryCandidateWindow(now: Date = new Date()): {
  /** `createdAt` até aqui já venceu por idade, com ou sem agendamento. */
  createdAtAteh: Date
  /** `scheduledAt` até aqui pode ter vencido pela margem de segurança. */
  scheduledAtAteh: Date
} {
  return {
    createdAtAteh: new Date(now.getTime() - PENDING_MAX_AGE_HOURS * 60 * 60 * 1000),
    scheduledAtAteh: new Date(now.getTime() + SCHEDULED_SAFETY_MARGIN_HOURS * 60 * 60 * 1000),
  }
}

/**
 * Coleta em LOTES até completar o limite — ou até a fonte acabar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O ERRO QUE ESTA FUNÇÃO EXISTE PARA NÃO COMETER
 *
 * O caminho curto seria buscar 300 candidatos e filtrar. Como o refino só
 * REMOVE linhas, 300 candidatos com 40 falsos positivos devolveriam 260 — e as
 * solicitações válidas que estavam logo depois do corte, as MAIS ANTIGAS,
 * simplesmente não apareceriam. Numa tela de investigação, a linha antiga
 * omitida costuma ser exatamente a que se procura.
 *
 * Aqui o `take` do banco é o tamanho do LOTE, não o teto do resultado: enquanto
 * faltar linha aceita e ainda houver fonte, volta-se ao banco.
 *
 * Genérica e pura (o efeito fica todo em `lerLote`) para que a propriedade que
 * importa — "não omite" — seja testável com uma fonte falsa, sem banco.
 */
export async function coletarEmLotes<T>(params: {
  /** Lê o próximo lote depois do cursor. `undefined` no primeiro. */
  lerLote: (depoisDe: string | undefined) => Promise<T[]>
  /** Decide se a linha entra no resultado. */
  aceita: (item: T) => boolean
  /** Identificador estável para o cursor. */
  idDe: (item: T) => string
  limite: number
  tamanhoDoLote: number
  /** Trava de segurança contra laço infinito, não parte do algoritmo. */
  maxLotes: number
}): Promise<T[]> {
  const { lerLote, aceita, idDe, limite, tamanhoDoLote, maxLotes } = params
  const aceitas: T[] = []
  let cursor: string | undefined

  for (let volta = 0; volta < maxLotes; volta++) {
    const lote = await lerLote(cursor)
    if (lote.length === 0) break

    for (const item of lote) {
      if (aceita(item)) aceitas.push(item)
      if (aceitas.length === limite) return aceitas
    }

    // Lote menor que o pedido só acontece quando a fonte acabou.
    if (lote.length < tamanhoDoLote) break
    cursor = idDe(lote[lote.length - 1]!)
  }

  return aceitas
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
