/**
 * Módulo: backoffice
 * Camada: domain — leitura OPERACIONAL de uma entrega de push.
 *
 * Função pura. Sem banco, sem Next.js — a matriz inteira vira `assert`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A REGRA QUE ESTE ARQUIVO EXISTE PARA IMPOR
 *
 * `acceptedCount` significa que o PUSH SERVICE aceitou a mensagem para
 * entrega. Não significa que o aparelho mostrou nada: ele pode estar offline
 * (fica na fila com TTL), com notificação muda no SO, ou o Service Worker pode
 * falhar ao renderizar. `DEVICE_DISPLAYED` não é observável por Web Push e não
 * existe em lugar nenhum deste sistema.
 *
 * Por isso nenhum rótulo daqui diz "recebeu", "entregue ao usuário" ou
 * equivalente — e há teste que falha se alguém introduzir um.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPRESSÃO NÃO É FALHA — E QUASE NÃO É OBSERVÁVEL
 *
 * O anti-spam de `care_update` vive DENTRO do eventKey (janela de 1h). O
 * primeiro update da janela cria a linha; os seguintes colidem no unique e
 * **não criam linha nenhuma**. Ou seja: uma supressão esperada não deixa
 * rastro em `push_deliveries` — não há o que classificar, e contá-la como
 * falha seria impossível justamente porque ela é invisível.
 *
 * O que É observável e costuma ser confundido com falha: `attempted = 0`. Isso
 * significa "nenhum device elegível no momento" — o usuário não tinha
 * subscription, ou as que tinha pertenciam a outro ambiente (isolamento de
 * VAPID/environment). O dispatcher documenta isso como contrato: NUNCA conta
 * como `failed`. Este módulo mantém a mesma leitura.
 */

// Caminho relativo com extensão explícita, não o alias `@/`: o runner de
// testes do Node (`--experimental-strip-types`) não resolve o alias do
// tsconfig, e este módulo precisa continuar testável fora do bundler.
import {
  parseDeliveryDiagnostic,
  type DeliveryDiagnostic,
} from "../../notifications/domain/push-failure.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Classificação
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_DELIVERY_OUTCOMES = [
  /** O push service aceitou. NÃO é prova de que o aparelho exibiu. */
  "ACCEPTED_BY_PROVIDER",
  /** Nenhum device elegível. Não é falha — ver o cabeçalho. */
  "NO_ELIGIBLE_DEVICE",
  /** 401/403, VAPID inválida, sender lançou. Problema NOSSO. */
  "CONFIGURATION_FAILURE",
  /** Timeout, 429, 5xx. Pode ter sido momentâneo. */
  "TRANSIENT_FAILURE",
  /** 404/410 e demais 4xx. Não adianta repetir. */
  "PERMANENT_FAILURE",
  /** Falhou, mas o `lastError` é anterior ao formato estruturado. */
  "UNCLASSIFIED_FAILURE",
] as const

export type PushDeliveryOutcome = (typeof PUSH_DELIVERY_OUTCOMES)[number]

/** O que a tabela `push_deliveries` guarda, sem nada derivado. */
export type PushDeliveryFacts = {
  attemptedCount: number
  acceptedCount: number
  failedCount: number
  invalidCount: number
  lastError: string | null
}

export type PushDeliveryReading = {
  outcome: PushDeliveryOutcome
  /**
   * Chegou ao provider em ALGUNS devices e falhou em outros.
   *
   * Existe porque `outcome` sozinho mentiria nos dois sentidos numa entrega
   * multi-device: chamá-la de aceita esconderia o aparelho que ficou sem;
   * chamá-la de falha esconderia o que recebeu.
   */
  parcial: boolean
  /** Diagnóstico estruturado, quando a linha é posterior ao formato novo. */
  diagnostico: DeliveryDiagnostic | null
  /** Reenvios feitos nesta entrega. `null` quando a linha é legada. */
  retries: number | null
}

/**
 * Lê uma entrega.
 *
 * ORDEM DAS GUARDAS — da causa mais acionável para a menos:
 *
 *   configuração → permanente → transitória → aceita → sem device
 *
 * Configuração vem primeiro porque é a única classe que exige alguém DA EQUIPE
 * agir (credencial, ambiente); as outras descrevem o mundo. Numa entrega em que
 * um device tomou 403 e outro foi aceito, o que precisa aparecer na triagem é
 * o 403 — e `parcial` preserva a informação de que alguém recebeu.
 */
export function lerEntregaPush(fatos: PushDeliveryFacts): PushDeliveryReading {
  const diagnostico = parseDeliveryDiagnostic(fatos.lastError)
  const retries = diagnostico ? diagnostico.retries : null

  const houveFalha =
    fatos.failedCount > 0 ||
    fatos.invalidCount > 0 ||
    (diagnostico !== null &&
      (diagnostico.transient > 0 || diagnostico.configuration > 0 || diagnostico.permanent > 0))

  const parcial = fatos.acceptedCount > 0 && houveFalha
  const base = { parcial, diagnostico, retries }

  if (diagnostico) {
    if (diagnostico.configuration > 0) return { outcome: "CONFIGURATION_FAILURE", ...base }
    if (diagnostico.permanent > 0 || fatos.invalidCount > 0) {
      return { outcome: "PERMANENT_FAILURE", ...base }
    }
    if (diagnostico.transient > 0) return { outcome: "TRANSIENT_FAILURE", ...base }
    // Diagnóstico presente sem nenhuma classe: só houve reenvio que deu certo.
    return {
      outcome: fatos.acceptedCount > 0 ? "ACCEPTED_BY_PROVIDER" : "NO_ELIGIBLE_DEVICE",
      ...base,
    }
  }

  // ── Linhas LEGADAS (anteriores ao formato estruturado) ───────────────────
  // `invalidCount` é coluna e continua confiável mesmo sem diagnóstico —
  // sempre foi exatamente 404/410.
  if (fatos.invalidCount > 0) return { outcome: "PERMANENT_FAILURE", ...base }
  if (fatos.failedCount > 0) return { outcome: "UNCLASSIFIED_FAILURE", ...base }
  if (fatos.acceptedCount > 0) return { outcome: "ACCEPTED_BY_PROVIDER", ...base }

  // attempted = 0, nada falhou: nenhum device elegível. NÃO é falha.
  return { outcome: "NO_ELIGIBLE_DEVICE", ...base }
}

/** Esta leitura pede atenção de alguém? Só o que é realmente acionável. */
export function exigeAtencao(leitura: PushDeliveryReading): boolean {
  return (
    leitura.outcome === "CONFIGURATION_FAILURE" ||
    leitura.outcome === "PERMANENT_FAILURE" ||
    leitura.outcome === "UNCLASSIFIED_FAILURE"
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Rótulos
//
// NENHUM deles pode afirmar que o usuário recebeu ou viu a notificação — só o
// aparelho sabe disso, e o sistema não tem como saber. Há teste que varre esta
// tabela procurando esse vocabulário.
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_OUTCOME_LABELS: Record<PushDeliveryOutcome, string> = {
  ACCEPTED_BY_PROVIDER: "Aceito pelo provedor",
  NO_ELIGIBLE_DEVICE: "Sem aparelho elegível",
  CONFIGURATION_FAILURE: "Falha de configuração",
  TRANSIENT_FAILURE: "Falha transitória",
  PERMANENT_FAILURE: "Falha permanente",
  UNCLASSIFIED_FAILURE: "Falha sem classificação",
}

/** Complemento curto — o que a pessoa precisa entender para não ler errado. */
export const PUSH_OUTCOME_HINTS: Record<PushDeliveryOutcome, string> = {
  ACCEPTED_BY_PROVIDER:
    "O provedor aceitou a mensagem. Não é prova de que o aparelho exibiu.",
  NO_ELIGIBLE_DEVICE:
    "Nenhum aparelho elegível no momento do evento. Não é falha de entrega.",
  CONFIGURATION_FAILURE: "Credencial ou ambiente incorretos. Exige ação da equipe.",
  TRANSIENT_FAILURE: "Instabilidade momentânea do canal. Houve reenvio automático.",
  PERMANENT_FAILURE: "Aparelho inalcançável. Subscription revogada quando 404/410.",
  UNCLASSIFIED_FAILURE: "Registro anterior ao diagnóstico estruturado.",
}

// ─────────────────────────────────────────────────────────────────────────────
// Mascaramento — nada que permita ENVIAR push pode sair daqui
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A tripla (endpoint, p256dh, auth) permite enviar push para o aparelho. O
 * repositório deste módulo nunca seleciona nenhuma delas; estas funções são a
 * segunda linha de defesa, para o que É exibido.
 *
 * `endpointHash` já é SHA-256 e não é reversível na prática, mas ainda assim é
 * cortado: o backoffice precisa CORRELACIONAR devices ("é o mesmo aparelho de
 * antes?"), e 12 caracteres hex bastam para isso sem publicar o hash inteiro.
 */
export function resumirEndpointHash(hash: string | null): string {
  if (!hash) return "—"
  return hash.slice(0, 12)
}

/** Fingerprint VAPID: deriva de chave pública, não é segredo. 8 chars bastam. */
export function resumirFingerprint(fingerprint: string | null): string {
  if (!fingerprint) return "legado"
  return fingerprint.slice(0, 8)
}

export const REVOKED_REASON_LABELS: Record<string, string> = {
  logout: "Logout",
  user_optout: "Desativado pelo usuário",
  gone: "Morta na origem (404/410)",
  account_cleanup: "Limpeza de conta",
}

export function rotularRevogacao(reason: string | null): string {
  if (!reason) return "—"
  return REVOKED_REASON_LABELS[reason] ?? reason
}
