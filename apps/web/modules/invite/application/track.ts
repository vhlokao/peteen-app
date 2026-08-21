import "server-only"

import { readVisitorKey } from "./visitor-key"
import {
  associateVisitorWithUser,
  markPetCreated,
  markRequestCreated,
  markServiceCompleted,
  markSignedUp,
} from "../infrastructure/repository"

/**
 * Hooks de conversão do funil de convite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTOS SÃO DERIVADOS DO SERVIDOR, NUNCA DO CLIENTE
 *
 * Cada função aqui é chamada de dentro de uma Server Action que JÁ concluiu
 * o efeito real (perfil criado, pet criado, request criada, atendimento
 * concluído). Nenhuma recebe flag, evento ou intenção vinda do browser — o
 * cliente não consegue marcar um estágio que não aconteceu.
 *
 * TODAS SÃO BEST-EFFORT: o repositório engole as próprias falhas, e estas
 * funções nunca lançam. Medição quebrada não pode quebrar produto.
 */

/**
 * Um usuário autenticado está com a landing aberta — associa as visitas
 * anônimas daquela chave a ele. NÃO marca cadastro: associação e cadastro
 * são fatos distintos (ver associateVisitorWithUser).
 *
 * Existe para que um tutor que JÁ tinha conta e chegou por um convite tenha
 * as ações seguintes (request, conclusão) atribuídas à landing correta — sem
 * isso, a atribuição só funcionaria para tutores novos.
 *
 * Sem cookie de visitante, não houve convite: não faz nada.
 */
export async function trackInviteVisitorAssociation(userId: string): Promise<void> {
  const visitorKey = await readVisitorKey()
  if (!visitorKey) return
  await associateVisitorWithUser(visitorKey, userId)
}

/**
 * Um tutor NOVO acabou de existir — associa (se ainda não estiver) e marca
 * SIGNED_UP. Este é o único ponto que carimba cadastro.
 */
export async function trackInviteSignup(userId: string): Promise<void> {
  const visitorKey = await readVisitorKey()
  if (!visitorKey) return
  await associateVisitorWithUser(visitorKey, userId)
  await markSignedUp(userId)
}

/** Primeiro pet do tutor convertido. */
export async function trackInvitePetCreated(userId: string): Promise<void> {
  await markPetCreated(userId)
}

/**
 * Request criada. `professionalId` é o da PRÓPRIA request — a trava de
 * atribuição vive no repositório, que só marca a visita daquele profissional.
 */
export async function trackInviteRequestCreated(
  userId: string,
  professionalId: string
): Promise<void> {
  await markRequestCreated(userId, professionalId)
}

/** Atendimento concluído — mesma trava de atribuição da Request. */
export async function trackInviteServiceCompleted(
  userId: string,
  professionalId: string
): Promise<void> {
  await markServiceCompleted(userId, professionalId)
}
