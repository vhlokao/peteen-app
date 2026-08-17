/**
 * Módulo: notifications
 * Camada: domain — identidade do PAR VAPID que criou/consome uma subscription.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O INCIDENTE QUE ISTO FECHA
 *
 * Produção e localhost usam pares VAPID diferentes e compartilham o mesmo
 * Supabase. As subscriptions criadas em produção ficavam visíveis para o
 * dispatcher local, que tentava assinar com a chave errada e recebia do FCM:
 *
 *   "the VAPID credentials in the authorization header do not correspond to
 *    the credentials used to create the subscriptions."
 *
 * Ninguém percebia: `PushDelivery` acumulava `failed` em silêncio. Pior, era
 * sorte que falhasse — sem barreira, um teste em dev podia acordar o telefone
 * de um usuário real de produção.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE O FINGERPRINT SOZINHO NÃO BASTA (Security Focal)
 *
 * A primeira versão deste módulo tratava a comparação de fingerprint como
 * autoridade única: "duas instalações com a MESMA chave são compatíveis, ainda
 * que uma se chame preview e a outra production". Isso confunde duas perguntas
 * diferentes:
 *
 *   fingerprint → "esta assinatura CONSEGUE ser aceita por este device?"
 *   ambiente    → "este sender TEM O DIREITO de acordar este device?"
 *
 * Na Vercel, marcar a mesma variável para Production, Preview e Development é o
 * caminho de menor resistência. Com chave compartilhada, o fingerprint bate e
 * um deploy de branch passaria a notificar o telefone de usuários reais — sem
 * erro, sem log de alarme, sem alteração de código. A segurança não pode
 * depender de uma configuração externa que o repositório não valida.
 *
 * Por isso a identidade tem DOIS eixos, e ambos precisam bater:
 *
 *   runtimeEnvironment  → estágio (production | preview | development)
 *   vapidKeyFingerprint → par de chaves
 *
 * Nenhum substitui o outro: o fingerprint impede o envio IMPOSSÍVEL (403 do
 * push service); o ambiente impede o envio INDEVIDO mas tecnicamente possível.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O FINGERPRINT NÃO É SEGREDO — E NÃO PODE VIRAR UM
 *
 * Derivado exclusivamente da chave PÚBLICA, que o browser já recebe como
 * `applicationServerKey`. Não permite reconstruir a privada: é SHA-256 de um
 * dado público. Pode ir para o banco, para log e para o relatório.
 *
 * A privada NUNCA participa deste cálculo. Se algum dia alguém a passar aqui
 * por engano, o resultado seria um hash de segredo persistido no banco — por
 * isso a função recebe um parâmetro com nome explícito e este comentário.
 */

import { createHash } from "node:crypto"

/**
 * Forma canônica antes do hash — o ponto mais fácil de errar.
 *
 * A mesma chave P-256 pode chegar como base64url (padrão Web Push, sem
 * padding) ou base64 clássico, com ou sem `=`. Hashear a string crua faria a
 * MESMA chave produzir fingerprints diferentes conforme quem a escreveu no
 * `.env` — e o dispatcher passaria a considerar incompatível uma subscription
 * perfeitamente válida, que é exatamente o bug que este módulo existe para
 * impedir.
 *
 * Canonicalização: decodifica os bytes e re-serializa em base64url sem
 * padding. Assim `+`/`-`, `/`/`_` e `=` deixam de importar.
 */
export function canonicalizarChavePublicaVapid(publicKeyBase64: string): string {
  const semEspacos = publicKeyBase64.trim()
  const base64 = semEspacos.replace(/-/g, "+").replace(/_/g, "/")
  const bytes = Buffer.from(base64, "base64")
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Tamanho do fingerprint guardado. Espelha o VARCHAR(64) da migration. */
export const VAPID_FINGERPRINT_LENGTH = 64

/**
 * Identidade estável do par VAPID, a partir da chave PÚBLICA.
 *
 * SHA-256 hex completo (64 chars). Não truncamos: o campo é barato e um
 * fingerprint curto convidaria a colisões acidentais entre ambientes num
 * cenário em que "compatível" significa "pode enviar push para este device".
 */
export function vapidFingerprintFromPublicKey(publicKeyBase64: string): string {
  const canonica = canonicalizarChavePublicaVapid(publicKeyBase64)
  return createHash("sha256").update(canonica).digest("hex")
}

// ─────────────────────────────────────────────────────────────────────────────
// Elegibilidade — a regra que o dispatcher aplica
// ─────────────────────────────────────────────────────────────────────────────

/** Estágio do runtime. Metade da identidade — a outra é o fingerprint. */
export type PushRuntimeEnvironment = "production" | "preview" | "development"

/**
 * Identidade completa do ambiente que está criando ou consumindo subscriptions.
 * Existe como TIPO ÚNICO para que os dois eixos andem sempre juntos: um create
 * que gravasse só o fingerprint produziria identidade parcial silenciosamente.
 * Montada em `getCurrentPushIdentity` (infrastructure), nunca pelo client.
 */
export type PushIdentity = {
  vapidKeyFingerprint: string
  runtimeEnvironment: PushRuntimeEnvironment
}

export type SubscriptionEligibility =
  /** Os DOIS eixos batem — mesmo estágio, mesma chave. */
  | { eligible: true; motivo: "identidade_compativel" }
  /**
   * Identidade ausente ou parcial, runtime é produção, e nada do que se sabe
   * contradiz este sender: tentamos UMA vez. Se o push service aceitar, isso É
   * a prova, e a identidade completa passa a ser gravada (ver dispatch-push).
   */
  | { eligible: true; motivo: "legacy_producao" }
  /** Outro estágio. Pode ser a MESMA chave — e ainda assim não é nosso device. */
  | { eligible: false; motivo: "environment_divergente" }
  /** Outro par VAPID. Enviar seria 403 garantido. */
  | { eligible: false; motivo: "fingerprint_divergente" }
  /**
   * Identidade incompleta fora de produção. NÃO tentamos: essas linhas quase
   * certamente vêm de produção, e tentar significa (a) 403 provável e (b) risco
   * de acordar o aparelho de um usuário real a partir de uma máquina de
   * desenvolvimento ou de um deploy de branch.
   */
  | { eligible: false; motivo: "legacy_fora_de_producao" }

/**
 * Esta subscription pode receber push DESTE sender?
 *
 * ORDEM E FORMA DA REGRA — as duas foram escolhidas, não são acidente:
 *
 *  1. Cada eixo CONHECIDO é verificado, mesmo quando o outro falta. Uma
 *     identidade parcial nunca relaxa o que já se sabe: se o fingerprint está
 *     gravado e diverge, não há tentativa, ainda que o ambiente seja NULL.
 *
 *  2. O ambiente é verificado ANTES do fingerprint. Quando os dois divergem, o
 *     rótulo mais útil para quem investiga é o do estágio: "outro ambiente" é
 *     esperado e benigno (uma máquina de dev olhando o banco compartilhado),
 *     enquanto `fingerprint_divergente` passa a significar, com precisão,
 *     "MESMO estágio, chave errada" — e isso é alarme de configuração.
 *
 * `subscriptionEnvironment` é `string | null`, não `PushRuntimeEnvironment |
 * null`, de propósito: o valor vem do banco e uma versão futura pode gravar um
 * rótulo que este código não conhece. Comparando como string, o desconhecido
 * nunca é igual a nenhum sender válido e o resultado é SKIP — enquanto
 * normalizá-lo para `null` o degradaria a legado e permitiria uma tentativa.
 * O erro seguro é não enviar.
 */
export function avaliarElegibilidade(params: {
  subscriptionFingerprint: string | null
  subscriptionEnvironment: string | null
  senderFingerprint: string
  senderEnvironment: PushRuntimeEnvironment
}): SubscriptionEligibility {
  const {
    subscriptionFingerprint,
    subscriptionEnvironment,
    senderFingerprint,
    senderEnvironment,
  } = params

  // ── 1. Nenhum eixo conhecido pode ser contrariado ────────────────────────
  if (subscriptionEnvironment !== null && subscriptionEnvironment !== senderEnvironment) {
    return { eligible: false, motivo: "environment_divergente" }
  }
  if (subscriptionFingerprint !== null && subscriptionFingerprint !== senderFingerprint) {
    return { eligible: false, motivo: "fingerprint_divergente" }
  }

  // ── 2. Identidade completa e coerente ────────────────────────────────────
  if (subscriptionEnvironment !== null && subscriptionFingerprint !== null) {
    return { eligible: true, motivo: "identidade_compativel" }
  }

  // ── 3. Identidade ausente ou parcial → só produção, uma tentativa ────────
  // Chegar aqui significa que o que se sabe é compatível, mas não é suficiente
  // para afirmar pertencimento. Só produção tem permissão de descobrir isso
  // enviando; preview e development param, porque o custo de errar é acordar o
  // telefone de um usuário real.
  return senderEnvironment === "production"
    ? { eligible: true, motivo: "legacy_producao" }
    : { eligible: false, motivo: "legacy_fora_de_producao" }
}
