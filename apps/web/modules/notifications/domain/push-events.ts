/**
 * Módulo: notifications
 * Camada: domain — construção de eventKey, copy segura e classificação de
 * resultado do push service.
 *
 * TUDO AQUI É FUNÇÃO PURA. Sem banco, sem rede, sem Next.js — testável com
 * `node --experimental-strip-types --test`.
 */

import type { PushPayload, PushSendOutcome } from "./push-types"

// ─────────────────────────────────────────────────────────────────────────────
// eventKey — identidade lógica do evento
//
// Por que uma string opaca em vez da tupla (eventType, entityId): a identidade
// de um evento nem sempre é "tipo + uma entidade". `dispute-status` precisa do
// status para distinguir OPEN de RESOLVED na MESMA disputa. Codificar isso na
// tupla obrigaria a inflar `eventType` (poluindo a taxonomia) ou `entityId`
// (fazendo a coluna deixar de conter um id de entidade). A chave opaca move a
// decisão para o domínio, onde ela pertence; o schema para de opinar.
//
// `eventType` e `entityId` continuam persistidos ao lado, desnormalizados, só
// para observabilidade — nunca participam do dedup.
//
// Formato: "<tipo>:<parte>[:<parte>...]"
//   request-created:<requestId>
//   request-accepted:<requestId>
//   care-update:<careUpdateId>
//   dispute-status:<disputeId>:<status>
// ─────────────────────────────────────────────────────────────────────────────

/** Espelha VARCHAR(200) do schema. Estourar é bug de construção, não de dado. */
export const EVENT_KEY_MAX_LENGTH = 200

export class InvalidEventKeyError extends Error {
  constructor(motivo: string) {
    super(`eventKey inválido: ${motivo}`)
    this.name = "InvalidEventKeyError"
  }
}

/**
 * Monta um eventKey a partir de um tipo e uma ou mais partes.
 *
 * Rejeita partes vazias ou com ":" — um separador dentro de uma parte tornaria
 * duas chaves diferentes colidíveis (ex.: ["a:b","c"] e ["a","b:c"] virariam a
 * mesma string), o que quebraria a idempotência de forma silenciosa.
 */
export function buildEventKey(tipo: string, ...partes: string[]): string {
  if (!tipo || tipo.includes(":")) {
    throw new InvalidEventKeyError("tipo vazio ou contendo ':'")
  }
  if (partes.length === 0) {
    throw new InvalidEventKeyError("ao menos uma parte é obrigatória")
  }
  for (const parte of partes) {
    if (!parte || parte.includes(":")) {
      throw new InvalidEventKeyError("parte vazia ou contendo ':'")
    }
  }

  const key = [tipo, ...partes].join(":")
  if (key.length > EVENT_KEY_MAX_LENGTH) {
    throw new InvalidEventKeyError(`excede ${EVENT_KEY_MAX_LENGTH} caracteres`)
  }
  return key
}

// ─────────────────────────────────────────────────────────────────────────────
// Classificação da resposta do push service
//
// `accepted` = o push service ACEITOU a mensagem para entrega. Não é entrega ao
// device: o aparelho pode estar offline (fica na fila com TTL), o usuário pode
// ter notificação muda no SO, o SW pode falhar ao renderizar. Por isso não
// existe "delivered" em lugar nenhum deste código.
//
// 404/410 = subscription realmente morta no push service → revogar como `gone`.
// NUNCA confundir isso com logout: são sistemas independentes, e um signOut
// (mesmo global) jamais invalida uma subscription Web Push.
// ─────────────────────────────────────────────────────────────────────────────

export function classifyPushStatus(statusCode: number): PushSendOutcome {
  if (statusCode >= 200 && statusCode < 300) return "accepted"
  if (statusCode === 404 || statusCode === 410) return "invalid"
  return "failed"
}

// ─────────────────────────────────────────────────────────────────────────────
// COPY SEGURA — constantes, nunca interpoladas
//
// Mais restrita que a copy in-app de propósito. A central in-app pode dizer
// "Fulano aceitou sua solicitação" porque exige sessão para ser lida; a
// lockscreen é visível a qualquer um por perto.
//
// PROIBIDO em qualquer copy daqui: nome, pet, tutor, profissional, telefone,
// endereço, preço, dado de saúde, motivo de disputa, conteúdo de Care Timeline.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rota de smoke da Foundation. Fixa, segura e não sensível: é a própria central
 * de notificações do tutor, que já exige sessão e não expõe nada por si só.
 * Quando a integração real começar, os deep links passam a vir de
 * infrastructure/links.ts — nunca reconstruídos à mão.
 */
export const PUSH_SMOKE_URL = "/tutor/notifications"

/** Destino usado quando a rota fornecida não é interna e segura. */
export const PUSH_FALLBACK_URL = "/"

// ─────────────────────────────────────────────────────────────────────────────
// Normalização de rota — PARSER, não prefixo
//
// A QA independente comprovou que checar `startsWith("//")` é insuficiente:
// "/\evil.example" passa pelo filtro e o parser WHATWG (o mesmo que o browser
// usa em clients.openWindow) resolve para https://evil.example/ — open redirect.
// Backslash é equivalente a barra na porção de autoridade pela especificação de
// URL, então qualquer filtro por prefixo perde essa classe inteira de bypass.
//
// A única fonte de verdade confiável é o próprio parser: resolve contra a
// origem e exige que o resultado permaneça na MESMA origem.
//
// Esta função é o espelho server-side de `sanitizeUrl` em public/sw.js. As duas
// existem separadas porque o SW não pode importar TypeScript — e por isso as
// DUAS são exercitadas pela mesma matriz de URLs nos testes.
// ─────────────────────────────────────────────────────────────────────────────

/** Origem sintética: só serve de base para resolver rotas relativas. */
const ORIGEM_DE_VALIDACAO = "https://peteen.invalid"

/**
 * Devolve `pathname + search + hash` quando a entrada resolve para a MESMA
 * origem; caso contrário devolve o fallback interno.
 *
 * Aceita apenas rota relativa: entrada absoluta (mesmo apontando para a nossa
 * origem) é recusada, porque em produção a origem real varia por ambiente e
 * comparar host aqui criaria acoplamento a domínio.
 */
export function sanitizeInternalRoute(raw: unknown): string {
  if (typeof raw !== "string") return PUSH_FALLBACK_URL
  const bruto = raw.trim()
  if (bruto.length === 0) return PUSH_FALLBACK_URL

  let parsed: URL
  try {
    parsed = new URL(bruto, ORIGEM_DE_VALIDACAO)
  } catch {
    return PUSH_FALLBACK_URL
  }

  // Qualquer coisa que escape da origem (absoluta, //host, /\host, javascript:,
  // data:) cai aqui. É o parser decidindo, não uma regex.
  if (parsed.origin !== ORIGEM_DE_VALIDACAO) return PUSH_FALLBACK_URL

  const destino = `${parsed.pathname}${parsed.search}${parsed.hash}`
  return destino.startsWith("/") ? destino : PUSH_FALLBACK_URL
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY DE PAYLOAD — única porta de construção
//
// Callers de domínio escolhem um `kind` de um conjunto fechado e uma rota. Não
// fornecem title/body. Isso torna estruturalmente impossível interpolar nome,
// pet, tutor, profissional, endereço, telefone, dado de saúde, motivo de
// disputa ou conteúdo de Care Timeline na lockscreen.
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_NOTIFICATION_KINDS = [
  /** Verificação técnica do canal. Sem evento de negócio associado. */
  "smoke",
  /** Conectados desde a integração P0. */
  "request_created",
  "request_accepted",
  /** R2B.3 — contrato operacional do atendimento. */
  "service_started",
  "care_update",
  "service_completed",
  /**
   * Cancelamento. Dois kinds em vez de um com parâmetro: a copy precisa dizer
   * QUEM cancelou, e a factory não aceita interpolação por construção. Quem
   * cancelou é fato do servidor (o status de destino), nunca texto montado.
   */
  "request_cancelled_by_tutor",
  "request_cancelled_by_professional",
] as const

export type PushNotificationKind = (typeof PUSH_NOTIFICATION_KINDS)[number]

/**
 * Copy por kind. CONSTANTE — nenhuma entrada aqui aceita parâmetro.
 * Deliberadamente mais restrita que a copy in-app: a central exige sessão para
 * ser lida, a lockscreen é visível a qualquer um por perto.
 */
const COPY_POR_KIND: Readonly<Record<PushNotificationKind, { title: string; body: string; tag: string }>> = {
  smoke: {
    title: "Peteen",
    body: "Notificações ativadas neste dispositivo.",
    tag: "peteen-smoke",
  },
  request_created: {
    title: "Nova solicitação",
    body: "Você recebeu uma nova solicitação de atendimento.",
    tag: "peteen-request",
  },
  request_accepted: {
    title: "Solicitação aceita",
    body: "Sua solicitação foi aceita. Toque para ver os detalhes.",
    tag: "peteen-request",
  },
  /**
   * "O atendimento começou", não "o atendimento do seu pet começou": a política
   * de copy deste módulo já proíbe as palavras "pet" e "tutor" na lockscreen
   * (ver o teste de termos sensíveis). A missão descreve a copy como
   * conceitual; manter a política existente vale mais que a literalidade, e o
   * significado é idêntico.
   */
  service_started: {
    title: "Atendimento iniciado",
    body: "O atendimento começou.",
    tag: "peteen-request",
  },
  /**
   * Genérica por obrigação, não por preguiça: o conteúdo de um CareUpdate pode
   * conter saúde, medicação, incidente ou rotina da casa — e a lockscreen é
   * visível a qualquer um por perto. O Push diz que EXISTE novidade; o Diário
   * autenticado mostra o quê.
   *
   * Tag própria: um care_update não pode substituir na bandeja do SO um aviso
   * de conclusão (e vice-versa) — são assuntos distintos para o tutor.
   */
  care_update: {
    title: "Nova atualização do atendimento",
    body: "Há uma nova atualização no Diário de cuidado.",
    tag: "peteen-care",
  },
  service_completed: {
    title: "Atendimento concluído",
    body: "O atendimento foi concluído. Conte como foi sua experiência.",
    tag: "peteen-request",
  },
  /**
   * Vai para o PROFISSIONAL. "Cliente" e não "tutor" por dois motivos que
   * coincidem: é o vocabulário que a interface do profissional já usa
   * ("Cliente recorrente", /professional/clients) e "tutor" é termo proibido
   * na copy de push. Nenhum nome — só o papel.
   */
  request_cancelled_by_tutor: {
    title: "Solicitação cancelada",
    body: "O cliente cancelou a solicitação.",
    tag: "peteen-request",
  },
  request_cancelled_by_professional: {
    title: "Solicitação cancelada",
    body: "O profissional cancelou a solicitação.",
    tag: "peteen-request",
  },
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ESCOPO DA TAG POR ENTIDADE — GATE-13-NOTIFICATION-RELIABILITY-QA-001
 *
 * O DEFEITO: `tag` vinha SÓ da tabela de copy, e seis dos oito kinds usavam a
 * mesma string literal `peteen-request`. Como o SO colapsa notificações de
 * mesma tag, duas solicitações DIFERENTES produziam avisos que se substituíam
 * na bandeja — e, pior, a substituição é SILENCIOSA (`renotify` é `false` por
 * padrão): a segunda não toca, não vibra e não aparece como heads-up.
 *
 * O sintoma observável é exatamente "a notificação não chegou". Ela chegou: o
 * push service aceitou, o SW executou, e o SO trocou uma pela outra sem avisar
 * ninguém. O deep link da primeira sumia junto.
 *
 * A CORREÇÃO: a tag passa a carregar a ENTIDADE. Duas solicitações distintas
 * nunca mais colidem. O que continua colapsando é o que sempre foi a intenção
 * do mecanismo:
 *
 *   - reenvio do MESMO evento (o retry documentado em dispatch-push.ts) —
 *     mesma entidade, mesma tag, substitui em vez de empilhar;
 *   - a evolução de UMA solicitação (aceita → iniciada → concluída) —
 *     uma notificação viva por atendimento, sempre no estado mais recente.
 *
 * `care_update` mantém a faixa própria (`peteen-care`), decisão já existente:
 * novidade no Diário não pode substituir um aviso de conclusão.
 *
 * `entityId` é OPCIONAL para o `smoke`, que não tem entidade — e só para ele.
 * Um teste percorre os kinds de negócio e falha se algum voltar a produzir tag
 * sem escopo.
 */
function escoparTag(base: string, entityId?: string | null): string {
  const id = entityId?.trim()
  if (!id) return base
  // Sem interpolação de dado do usuário: `entityId` é id interno (cuid), nunca
  // nome, e-mail ou texto livre. A tag não é exibida — é chave de colapso.
  return `${base}:${id}`
}

/**
 * ÚNICA forma de obter um PushPayload. A marca privada do tipo impede qualquer
 * literal montado fora daqui.
 */
export function buildPushPayload(
  kind: PushNotificationKind,
  rota: string,
  entityId?: string | null
): PushPayload {
  const copy = COPY_POR_KIND[kind]
  const payload = {
    title: copy.title,
    body: copy.body,
    url: sanitizeInternalRoute(rota),
    tag: escoparTag(copy.tag, entityId),
  }
  // Único ponto de cast do módulo: aqui a marca é aplicada, depois de a copy
  // vir da tabela constante e a rota passar pelo parser.
  return payload as PushPayload
}

/** Kinds que SEMPRE têm entidade — todos menos o smoke técnico. */
export const PUSH_KINDS_COM_ENTIDADE = PUSH_NOTIFICATION_KINDS.filter(
  (k) => k !== "smoke"
) as ReadonlyArray<Exclude<PushNotificationKind, "smoke">>

/** Payload técnico de verificação do canal, sem evento de negócio. */
export const SMOKE_PAYLOAD: PushPayload = buildPushPayload("smoke", PUSH_SMOKE_URL)

/**
 * Detecta interpolação acidental de dado em uma copy. Usado nos testes como
 * trava: se alguém trocar uma constante por template string, o teste quebra e
 * força ler o porquê.
 */
export function copyPareceInterpolada(texto: string): boolean {
  return /\$\{|\{\{|%s|\[object |undefined|null/.test(texto)
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-SPAM DE care_update — bucket temporal determinístico
//
// Decisão de produto V0: no máximo 1 PUSH de care_update por Request por hora.
// Limita INTERRUPÇÃO, não registro: o CareUpdate é criado normalmente, aparece
// no Diário e na central in-app. Só o canal push é represado.
//
// Implementado como parte do eventKey, e não como uma tabela de rate limit
// nova: o unique de PushDelivery (eventKey, recipientUserId, channel) JÁ é o
// mecanismo de "só uma vez". Colocar a janela dentro da chave transforma o
// anti-spam num caso particular do dedup que já existe e já foi testado —
// nenhum sistema paralelo, nenhum cron, nenhum estado client-side.
//
// UTC de propósito. O bucket não é exibido a ninguém, nunca é comparado com
// horário civil e não participa de nenhuma regra de agenda — ele só precisa
// ser ESTÁVEL e monotônico. Usar America/Sao_Paulo aqui só acrescentaria
// dependência de tz e um degrau extra em mudança de offset, sem nenhum ganho.
// (Contraste deliberado com scheduledAt, que é horário civil de verdade e por
// isso vive em lib/date/zoned-datetime.ts.)
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_UPDATE_PUSH_WINDOW_MS = 60 * 60 * 1000

/**
 * Índice inteiro da janela de 1h em que `now` cai, contado a partir da época.
 * Determinístico e calculado SEMPRE no servidor: nenhuma entrada vem do
 * browser.
 */
export function careUpdatePushBucket(now: Date): number {
  return Math.floor(now.getTime() / CARE_UPDATE_PUSH_WINDOW_MS)
}
