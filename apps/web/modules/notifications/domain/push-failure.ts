/**
 * Módulo: notifications
 * Camada: domain — CLASSIFICAÇÃO de falha de envio, política de retry e o
 * formato de diagnóstico gravado em `PushDelivery.lastError`.
 *
 * TUDO AQUI É FUNÇÃO PURA. Sem banco, sem rede, sem relógio implícito.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTAVA ERRADO ANTES
 *
 * O dispatcher tinha DUAS categorias: `invalid` (404/410, revoga) e `failed`
 * (todo o resto). Um 403 de VAPID malconfigurada, um 503 momentâneo do FCM e um
 * timeout de rede eram indistinguíveis — todos viravam `failedCount++` e um
 * `lastError` solto. Isso produziu dois efeitos ruins ao mesmo tempo:
 *
 *   - falha TRANSITÓRIA morria na primeira tentativa, sem retry;
 *   - falha de CONFIGURAÇÃO (o incidente real de 2026-08-15, `http_403`)
 *     ficava visualmente idêntica a "aparelho com problema", e ninguém
 *     conseguia separar "está mal configurado" de "está entregando mal".
 */

// ─────────────────────────────────────────────────────────────────────────────
// Classificação
// ─────────────────────────────────────────────────────────────────────────────

export type PushFailureClass =
  /** Não adianta repetir com este mesmo payload/subscription. */
  | "permanent"
  /** O envio pode dar certo daqui a instantes. Elegível a retry. */
  | "transient"
  /** NOSSO lado está errado (credencial/ambiente). Repetir só repete o erro. */
  | "configuration"

/**
 * Classe da falha a partir do status HTTP do push service.
 *
 * `null` significa que não houve resposta — DNS, socket, timeout do sender.
 * É a definição de transitório.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE 401/403 SÃO "configuration" E NÃO "permanent"
 *
 * Os dois significam que a assinatura VAPID não foi aceita: chave trocada,
 * `subject` inválido, ou — o caso real já visto em produção — um sender de
 * outro ambiente tentando falar com a subscription de alguém. Nada disso é
 * culpa do aparelho, e é por isso que a classe é própria: uma falha de
 * configuração NUNCA pode ser confundida com "device morto" e NUNCA pode
 * revogar a subscription (ver `ehSubscriptionMorta`).
 *
 * 429 é transitório por definição (rate limit tem janela). 5xx idem.
 * Os demais 4xx são permanentes: são erros de requisição que repetir não cura
 * (413 payload grande demais, 400 malformado).
 */
export function classifyPushFailure(statusCode: number | null): PushFailureClass {
  if (statusCode === null || !Number.isFinite(statusCode)) return "transient"
  if (statusCode === 401 || statusCode === 403) return "configuration"
  if (statusCode === 429) return "transient"
  if (statusCode >= 500) return "transient"
  return "permanent"
}

/**
 * Esta subscription está comprovadamente MORTA na origem?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DELIBERADAMENTE NÃO DERIVADO DE `PushFailureClass`. LEIA ANTES DE "SIMPLIFICAR".
 *
 * "permanente" e "morta" são perguntas diferentes e a diferença tem
 * consequência destrutiva. Um 413 (payload grande demais) é permanente — não
 * adianta reenviar — mas a subscription está perfeitamente viva, e o defeito é
 * NOSSO. Se a revogação fosse escrita como `classe === "permanent"`, um bug de
 * payload nosso passaria a revogar em massa os aparelhos de todos os usuários
 * atingidos, e cada um deles teria que reativar push manualmente.
 *
 * Só o push service pode declarar uma subscription morta, e ele faz isso com
 * exatamente dois códigos. Esta função é a única autoridade sobre isso.
 */
export function ehSubscriptionMorta(statusCode: number | null): boolean {
  return statusCode === 404 || statusCode === 410
}

// ─────────────────────────────────────────────────────────────────────────────
// Política de retry
//
// Restrição dura: o dispatch é AWAITADO dentro de uma Server Action, depois da
// operação de domínio já persistida. Cada milissegundo aqui é latência que o
// usuário sente numa operação que JÁ deu certo. Por isso o retry é curto,
// contado e — principalmente — limitado por um PRAZO, não só por tentativas.
// ─────────────────────────────────────────────────────────────────────────────

/** Tentativas EXTRA além da primeira. 2 = até 3 envios no total. */
export const PUSH_MAX_RETRY_ATTEMPTS = 2

/** Espera antes de cada retry, indexada por tentativa já consumida. */
export const PUSH_RETRY_BACKOFF_MS = [300, 900] as const

/**
 * Teto de tempo para a sequência INTEIRA de um device, medido desde o primeiro
 * envio. Verificado ANTES de cada retry.
 *
 * É o que torna o pior caso aceitável sem sacrificar o caso comum: uma falha
 * rápida (5xx em ~100ms) consome as duas retentativas e termina em ~1,4s; um
 * timeout de 3s consome o prazo e para depois do segundo envio, em vez de
 * empilhar três timeouts e somar mais de 9s na Server Action.
 */
export const PUSH_RETRY_DEADLINE_MS = 5000

export type DecisaoDeRetry =
  | { retry: true; esperarMs: number }
  | { retry: false; motivo: "classe_nao_elegivel" | "tentativas_esgotadas" | "prazo_esgotado" }

/**
 * Vale tentar de novo?
 *
 * `tentativasFeitas` conta envios JÁ realizados (1 depois do primeiro).
 * `decorridoMs` é o tempo desde o início da sequência deste device — injetado,
 * nunca lido de `Date.now()` aqui, para o teste poder exercer o prazo sem
 * relógio de verdade.
 */
export function decidirRetry(params: {
  classe: PushFailureClass
  tentativasFeitas: number
  decorridoMs: number
}): DecisaoDeRetry {
  const { classe, tentativasFeitas, decorridoMs } = params

  // Só transitório. Permanente não muda de ideia, e configuração erraria
  // igual nas três tentativas — repetir só multiplicaria o log.
  if (classe !== "transient") return { retry: false, motivo: "classe_nao_elegivel" }

  if (tentativasFeitas > PUSH_MAX_RETRY_ATTEMPTS) {
    return { retry: false, motivo: "tentativas_esgotadas" }
  }
  const espera = PUSH_RETRY_BACKOFF_MS[tentativasFeitas - 1]
  if (espera === undefined) return { retry: false, motivo: "tentativas_esgotadas" }

  if (decorridoMs >= PUSH_RETRY_DEADLINE_MS) {
    return { retry: false, motivo: "prazo_esgotado" }
  }

  return { retry: true, esperarMs: espera }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnóstico — telemetria SEM migration
//
// ─────────────────────────────────────────────────────────────────────────────
// POR QUE UMA STRING ESTRUTURADA, E NÃO COLUNAS NOVAS
//
// A auditoria pedia distinguir attempted / accepted / transitório / permanente
// / configuração / retries. O schema atual já entrega quatro deles em colunas
// (`attemptedCount`, `acceptedCount`, `invalidCount` = 404/410, `failedCount` =
// todo o resto). Faltava separar transitório de configuração DENTRO de
// `failedCount`, e o número de retries.
//
// Em vez de uma migration, isso passa a ser derivável de `lastError`, que já
// existe, já é VARCHAR(120) e já era gravado — só que como texto solto. Aqui
// ele vira formato fechado, com escritor e leitor testados lado a lado. O
// custo é honesto e está registrado: telemetria por parsing de string é pior
// que telemetria por coluna, e no dia em que houver dashboard de verdade a
// migration certa é acrescentar `transientCount`/`configCount`/`retryCount`.
// Enquanto isso, nada é perdido e nada precisou mudar no banco.
//
// NUNCA carrega PII: `last` recebe apenas códigos curtos já sanitizados pelo
// sender (`http_503`, `network_error`), jamais corpo de resposta ou endpoint.
// ─────────────────────────────────────────────────────────────────────────────

/** Espelha VARCHAR(120) de `PushDelivery.lastError`. */
export const DELIVERY_DIAGNOSTIC_MAX_LENGTH = 120

export type DeliveryDiagnostic = {
  transient: number
  configuration: number
  permanent: number
  /** Total de reenvios feitos na entrega inteira, somando todos os devices. */
  retries: number
  /** Código curto da última falha observada. */
  last: string | null
}

const VAZIO: DeliveryDiagnostic = {
  transient: 0,
  configuration: 0,
  permanent: 0,
  retries: 0,
  last: null,
}

/**
 * Serializa o diagnóstico. Formato: `t=1 c=0 p=0 r=2 last=http_503`.
 *
 * Chaves de uma letra porque o orçamento é de 120 caracteres e `last` é a
 * parte que mais interessa preservar inteira — é ela que diz O QUE aconteceu.
 * Se o total estourar, quem é truncado é `last`, nunca os contadores: perder um
 * dígito de contagem corromperia o número em silêncio, enquanto um código de
 * erro truncado continua legível para quem investiga.
 */
export function formatDeliveryDiagnostic(d: DeliveryDiagnostic): string {
  const contadores = `t=${d.transient} c=${d.configuration} p=${d.permanent} r=${d.retries}`
  if (!d.last) return contadores

  const prefixo = `${contadores} last=`
  const espaco = DELIVERY_DIAGNOSTIC_MAX_LENGTH - prefixo.length
  if (espaco <= 0) return contadores.slice(0, DELIVERY_DIAGNOSTIC_MAX_LENGTH)
  return `${prefixo}${d.last.slice(0, espaco)}`
}

/**
 * Lê de volta. Devolve `null` para qualquer coisa que não seja este formato —
 * inclusive os `lastError` antigos, gravados como texto livre antes desta
 * missão. Devolver `null` (e não um diagnóstico zerado) é o que permite ao
 * leitor distinguir "entrega sem falha classificada" de "linha legada".
 */
export function parseDeliveryDiagnostic(raw: string | null): DeliveryDiagnostic | null {
  if (typeof raw !== "string") return null
  const m = /^t=(\d+) c=(\d+) p=(\d+) r=(\d+)(?: last=(.*))?$/.exec(raw.trim())
  if (!m) return null
  return {
    transient: Number(m[1]),
    configuration: Number(m[2]),
    permanent: Number(m[3]),
    retries: Number(m[4]),
    last: m[5] && m[5].length > 0 ? m[5] : null,
  }
}

/**
 * Acumulador usado pelo dispatcher enquanto percorre os devices.
 *
 * Imutável de propósito: o dispatcher soma dentro de um laço com `allSettled`,
 * onde um acumulador mutável compartilhado é a origem clássica de contagem
 * errada quando alguém transformar o laço em paralelo.
 */
export function acumularFalha(
  atual: DeliveryDiagnostic,
  entrada: { classe: PushFailureClass; codigo: string | null; retries: number }
): DeliveryDiagnostic {
  return {
    transient: atual.transient + (entrada.classe === "transient" ? 1 : 0),
    configuration: atual.configuration + (entrada.classe === "configuration" ? 1 : 0),
    permanent: atual.permanent + (entrada.classe === "permanent" ? 1 : 0),
    retries: atual.retries + entrada.retries,
    last: entrada.codigo ?? atual.last,
  }
}

export function diagnosticoVazio(): DeliveryDiagnostic {
  return { ...VAZIO }
}

/** Houve alguma falha classificada nesta entrega? */
export function temFalha(d: DeliveryDiagnostic): boolean {
  return d.transient > 0 || d.configuration > 0 || d.permanent > 0
}
