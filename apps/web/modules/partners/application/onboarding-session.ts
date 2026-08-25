import "server-only"

/**
 * Sessão de onboarding de parceiro — cookie assinado, sem login.
 *
 * Esta é a camada que conhece ambiente e cookie. A matemática da assinatura
 * vive em `domain/onboarding-capability.ts`, sem env e sem `next/headers`, para
 * poder ser testada com chaves conhecidas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O SEGREDO
 *
 * `ONBOARDING_SIGNING_SECRET`, dedicado. Nenhuma credencial existente foi
 * reaproveitada, e a razão é concreta: `SUPABASE_SERVICE_ROLE_KEY` dá acesso
 * total ao banco, `VAPID_PRIVATE_KEY` permite assinar push em nome do app e
 * rotaciona num ciclo próprio, `CRON_SECRET` é comparado em texto puro noutro
 * lugar. Usar qualquer uma como chave HMAC ampliaria o alcance de uma credencial
 * muito além do que ela existe para fazer — e amarraria a rotação de duas
 * coisas sem relação.
 *
 * FALHA FECHADO: sem segredo válido, nenhuma capability é emitida e nenhuma é
 * aceita. O onboarding para com erro em vez de operar sem prova — e o app segue
 * subindo, porque derrubar o processo inteiro por causa de um fluxo seria
 * transformar uma indisponibilidade parcial em total.
 *
 * ROTAÇÃO: trocar o segredo invalida todas as capabilities abertas — quem estava
 * no meio do onboarding recomeça. Aceitável no piloto; um key-ring com versões
 * seria a evolução, deliberadamente fora desta missão.
 */

import { cookies } from "next/headers"

import {
  CAPABILITY_TTL_SECONDS,
  emitirCapability,
  segredoUtilizavel,
  verificarCapability,
  type VerificationFailure,
} from "../domain/onboarding-capability"

/** Nome próprio — nunca compartilhado com outro fluxo. */
export const ONBOARDING_COOKIE = "peteen_partner_onboarding"

function lerSegredo(): string | null {
  const secret = process.env.ONBOARDING_SIGNING_SECRET
  return segredoUtilizavel(secret) ? secret : null
}

/**
 * Emite a capability e grava o cookie.
 *
 * PRÉ-CONDIÇÃO: `partnerId` veio do fluxo que criou/recuperou o Partner no
 * servidor. Não existe — e não deve passar a existir — um caminho que emita
 * capability para um id informado pelo cliente: seria um endpoint de
 * "assine para mim qualquer parceiro".
 *
 * Só pode ser chamada de Server Action ou Route Handler; Server Component de
 * página não pode escrever cookie.
 */
export async function emitirSessaoOnboarding(partnerId: string): Promise<boolean> {
  const secret = lerSegredo()
  if (!secret) {
    // Sem detalhe do segredo no log — só o fato de estar ausente/curto.
    console.error("[partner-onboarding] ONBOARDING_SIGNING_SECRET ausente ou fraco")
    return false
  }

  const token = emitirCapability({ partnerId, secret })
  const store = await cookies()
  store.set(ONBOARDING_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CAPABILITY_TTL_SECONDS,
  })
  return true
}

export type SessaoOnboarding =
  | { ok: true; partnerId: string }
  | { ok: false; motivo: VerificationFailure | "sem_segredo" }

/**
 * O parceiro desta sessão — a ÚNICA fonte de autoridade do onboarding público.
 *
 * Quem chama deve usar o `partnerId` daqui e ignorar qualquer id que tenha
 * chegado pelo input. É essa substituição que fecha o IDOR: o cliente perde a
 * capacidade de escolher sobre qual parceiro está operando.
 */
export async function lerSessaoOnboarding(): Promise<SessaoOnboarding> {
  const secret = lerSegredo()
  if (!secret) return { ok: false, motivo: "sem_segredo" }

  const store = await cookies()
  const token = store.get(ONBOARDING_COOKIE)?.value
  const resultado = verificarCapability(token, secret)

  return resultado.ok
    ? { ok: true, partnerId: resultado.capability.partnerId }
    : { ok: false, motivo: resultado.motivo }
}

/** Encerra a sessão — usado ao concluir o onboarding. */
export async function encerrarSessaoOnboarding(): Promise<void> {
  const store = await cookies()
  store.delete(ONBOARDING_COOKIE)
}

/**
 * Mensagem para quem chegou sem capability válida.
 *
 * Uma só frase para TODOS os motivos: distinguir "expirada" de "assinatura
 * inválida" para o cliente entregaria um oráculo de sondagem do formato do
 * token, sem ajudar em nada quem só quer voltar ao cadastro. O motivo real
 * continua disponível no servidor, em `SessaoOnboarding.motivo`.
 */
export const ONBOARDING_SESSAO_INVALIDA =
  "Sua sessão de cadastro expirou. Recomece o cadastro para continuar."
