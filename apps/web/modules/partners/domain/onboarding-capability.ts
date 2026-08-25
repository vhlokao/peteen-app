/**
 * Capability de onboarding de parceiro — assinatura e verificação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * O onboarding de parceiro é público POR DESENHO: quem preenche ainda não tem
 * conta, então não existe sessão de onde derivar posse. O módulo resolvia isso
 * aceitando `partnerId` como parâmetro das Server Actions — o que significa que
 * qualquer chamador podia informar o id de OUTRO parceiro e ler métricas
 * operacionais, alterar dados do negócio ou concluir o onboarding alheio.
 *
 * A correção não é exigir login (isso mataria o funil). É trocar "quem diz um
 * id" por "quem carrega uma prova que o servidor emitiu": o navegador recebe um
 * cookie assinado, e o `partnerId` passa a ser DERIVADO dessa prova. O cliente
 * deixa de ter voz sobre qual parceiro está sendo operado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE HMAC PRÓPRIO E NÃO JWT
 *
 * JWT traria uma dependência e, junto, a família de armadilhas que vive no
 * cabeçalho negociável: `alg: none`, confusão HS256/RS256, `kid` apontando para
 * chave arbitrária. Nada disso é necessário aqui — há UM algoritmo, UMA chave e
 * UM propósito. Um HMAC-SHA256 sobre um payload de formato fixo elimina a
 * negociação inteira: não existe campo no token capaz de mudar como ele é
 * verificado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO NÃO FAZ
 *
 * Não lê `process.env` nem toca em cookie. Recebe o segredo como parâmetro para
 * poder ser testado com chaves conhecidas, sem ambiente e sem servidor. Quem
 * cuida de env e cookie é `application/onboarding-session.ts`.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

/** Versão do formato. Muda quando o payload mudar de forma incompatível. */
export const CAPABILITY_VERSION = 1

/**
 * Propósito, verificado na leitura.
 *
 * Existe para que um cookie assinado com o MESMO segredo, mas emitido para
 * outra finalidade no futuro, não seja aceito aqui. Sem este campo, todo uso do
 * segredo passaria a valer como capability de onboarding.
 */
export const CAPABILITY_PURPOSE = "partner_onboarding"

/**
 * 24 horas.
 *
 * Longo o bastante para alguém começar o cadastro, sair para buscar o CNPJ e
 * voltar no dia seguinte — que é o comportamento real de um onboarding de
 * negócio. Curto o bastante para que um cookie copiado de uma máquina
 * compartilhada não valha indefinidamente. Ampliar exige revisar essa troca.
 */
export const CAPABILITY_TTL_SECONDS = 24 * 60 * 60

/** Entropia mínima exigida do segredo, em bytes. */
export const MIN_SECRET_BYTES = 32

export type OnboardingCapability = {
  v: number
  partnerId: string
  /** Emissão, em segundos desde a época. */
  iat: number
  /** Expiração, em segundos desde a época. */
  exp: number
  purpose: string
}

export type VerificationFailure =
  | "ausente"
  | "formato_invalido"
  | "assinatura_invalida"
  | "versao_incompativel"
  | "proposito_incorreto"
  | "expirada"

export type VerificationResult =
  | { ok: true; capability: OnboardingCapability }
  | { ok: false; motivo: VerificationFailure }

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64url")
}

/**
 * Serialização DETERMINÍSTICA — a ordem dos campos é fixa e explícita.
 *
 * `JSON.stringify` de um objeto preserva a ordem de inserção, o que funciona
 * por acidente. Montar a string campo a campo torna a ordem parte do contrato:
 * dois processos diferentes produzem exatamente os mesmos bytes, e a assinatura
 * não passa a falhar porque alguém reordenou uma propriedade no tipo.
 */
function serializar(cap: OnboardingCapability): string {
  return JSON.stringify({
    v: cap.v,
    partnerId: cap.partnerId,
    iat: cap.iat,
    exp: cap.exp,
    purpose: cap.purpose,
  })
}

function assinar(payloadB64: string, secret: string): string {
  return base64urlEncode(createHmac("sha256", secret).update(payloadB64).digest())
}

/** O segredo tem entropia suficiente para uso como chave HMAC? */
export function segredoUtilizavel(secret: string | undefined | null): secret is string {
  return typeof secret === "string" && Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES
}

/**
 * Emite a capability para o parceiro informado.
 *
 * PRÉ-CONDIÇÃO: `partnerId` foi resolvido pelo SERVIDOR, no fluxo que criou ou
 * recuperou o Partner. Emitir a partir de um id vindo do cliente devolveria ao
 * atacante exatamente a prova que este mecanismo existe para negar.
 */
export function emitirCapability(params: {
  partnerId: string
  secret: string
  agoraMs?: number
  ttlSegundos?: number
}): string {
  const agora = Math.floor((params.agoraMs ?? Date.now()) / 1000)
  const cap: OnboardingCapability = {
    v: CAPABILITY_VERSION,
    partnerId: params.partnerId,
    iat: agora,
    exp: agora + (params.ttlSegundos ?? CAPABILITY_TTL_SECONDS),
    purpose: CAPABILITY_PURPOSE,
  }
  const payloadB64 = base64urlEncode(Buffer.from(serializar(cap), "utf8"))
  return `${payloadB64}.${assinar(payloadB64, params.secret)}`
}

/**
 * Verifica e decodifica. FALHA FECHADO: qualquer anomalia devolve `ok: false`,
 * nunca uma capability parcial.
 *
 * ORDEM DAS CHECAGENS — a assinatura vem ANTES de qualquer leitura do conteúdo.
 * Interpretar `exp` ou `purpose` de um payload ainda não autenticado seria
 * decidir com base em dados que o atacante controla; só depois de a assinatura
 * bater é que os campos passam a significar algo.
 */
export function verificarCapability(
  token: string | undefined | null,
  secret: string,
  agoraMs?: number
): VerificationResult {
  if (!token) return { ok: false, motivo: "ausente" }

  const partes = token.split(".")
  if (partes.length !== 2) return { ok: false, motivo: "formato_invalido" }

  const [payloadB64, assinaturaRecebida] = partes as [string, string]
  if (!payloadB64 || !assinaturaRecebida) return { ok: false, motivo: "formato_invalido" }

  const esperada = assinar(payloadB64, secret)

  // `timingSafeEqual` lança quando os buffers têm tamanhos diferentes — daí a
  // comparação de comprimento antes. Ela não vaza nada útil: o tamanho de um
  // HMAC-SHA256 é sempre o mesmo, então diferença de tamanho já é lixo.
  const a = Buffer.from(assinaturaRecebida, "utf8")
  const b = Buffer.from(esperada, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, motivo: "assinatura_invalida" }
  }

  let cap: OnboardingCapability
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8")
    const bruto = JSON.parse(json) as Partial<OnboardingCapability>
    if (
      typeof bruto.v !== "number" ||
      typeof bruto.partnerId !== "string" ||
      typeof bruto.iat !== "number" ||
      typeof bruto.exp !== "number" ||
      typeof bruto.purpose !== "string" ||
      bruto.partnerId.length === 0
    ) {
      return { ok: false, motivo: "formato_invalido" }
    }
    cap = bruto as OnboardingCapability
  } catch {
    return { ok: false, motivo: "formato_invalido" }
  }

  if (cap.v !== CAPABILITY_VERSION) return { ok: false, motivo: "versao_incompativel" }
  if (cap.purpose !== CAPABILITY_PURPOSE) return { ok: false, motivo: "proposito_incorreto" }

  const agora = Math.floor((agoraMs ?? Date.now()) / 1000)
  if (agora >= cap.exp) return { ok: false, motivo: "expirada" }

  return { ok: true, capability: cap }
}
