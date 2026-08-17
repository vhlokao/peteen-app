/**
 * Módulo: notifications
 * Camada: domain — QUANDO convidar a ativar notificações e COM QUE texto
 * (Care Operations V0 — R2B.5).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PRINCÍPIO QUE ESTA REGRA PROTEGE
 *
 * Um `denied` é permanente no browser: não há segunda chance, nem por UI nem
 * por código. Por isso o produto não pede permissão — ele explica o benefício
 * e espera um gesto. Este módulo decide se existe benefício REAL a explicar
 * naquele momento; sem isso, o card viraria banner genérico e a pessoa negaria
 * por reflexo, queimando o canal para sempre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A COPY SÓ PODE PROMETER O QUE O CONTRATO R2B.3 REALMENTE ENVIA
 *
 * Esta é a restrição mais fácil de violar e a mais cara: prometer aviso de algo
 * que nunca chega ensina a pessoa a ignorar notificação. Os destinatários reais,
 * conforme push-service-request-events.ts:
 *
 *   TUTOR        → request_accepted, service_started, care_update,
 *                  service_completed, cancelamento pelo profissional
 *   PROFISSIONAL → request_created, cancelamento pelo tutor
 *
 * O profissional NÃO recebe início/Diário/conclusão — são atos dele próprio.
 * Por isso a copy dele fala de solicitações novas e de mudanças que partem do
 * tutor, nunca de "atualizações do atendimento".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE FUNÇÃO PURA
 *
 * O projeto não tem jsdom — decisão dentro do componente só seria verificável
 * por QA manual. Aqui a matriz persona × status vira `assert.equal`, no mesmo
 * padrão de `inapp-copy`, `photo-selection` e `active-request-sync`.
 */

import type { RequestStatus } from "@/modules/service-request/domain/types"

export type PushInvitePersona = "tutor" | "professional"

export type PushInviteCopy = {
  /**
   * Título orientado a BENEFÍCIO, nunca "Permitir notificações" — o rótulo
   * técnico não responde "por que eu ativaria isso?".
   */
  title: string
  description: string
}

/** CTA único em todos os contextos: a ação é sempre a mesma. */
export const PUSH_INVITE_CTA = "Ativar notificações"

/** Saída discreta. Não é "nunca mais": ver o contrato de dispensa no componente. */
export const PUSH_INVITE_DISMISS = "Agora não"

/**
 * Momentos com benefício real, por persona.
 *
 * `null` significa "não convide aqui" — e é a resposta para todo estado
 * terminal: com o atendimento encerrado, não há evento futuro a anunciar, e
 * pedir permissão ali seria pedir por pedir.
 */
const COPY_TUTOR: Partial<Record<RequestStatus, PushInviteCopy>> = {
  PENDING: {
    title: "Receba avisos sobre sua solicitação",
    description: "Ative as notificações para saber quando o profissional responder.",
  },
  ACCEPTED: {
    title: "Acompanhe o atendimento",
    description:
      "Receba avisos quando o atendimento começar e quando houver atualizações importantes.",
  },
  IN_PROGRESS: {
    title: "Não perca atualizações do cuidado",
    description: "Ative as notificações para saber quando houver novidades no Diário.",
  },
}

const COPY_PROFISSIONAL: Partial<Record<RequestStatus, PushInviteCopy>> = {
  PENDING: {
    title: "Não perca uma solicitação",
    description: "Receba avisos quando chegar uma nova solicitação de atendimento.",
  },
  // ACCEPTED e IN_PROGRESS compartilham a MESMA promessa porque o profissional
  // recebe o mesmo evento nos dois: o cancelamento partido do tutor. Prometer
  // "atualizações do atendimento" aqui seria falso — quem publica o Diário e
  // conclui é ele.
  ACCEPTED: {
    title: "Fique sabendo de mudanças",
    description: "Receba avisos se o cliente cancelar um atendimento já confirmado.",
  },
  IN_PROGRESS: {
    title: "Fique sabendo de mudanças",
    description: "Receba avisos se o cliente cancelar um atendimento já confirmado.",
  },
}

export function resolvePushInviteCopy(
  persona: PushInvitePersona,
  status: RequestStatus
): PushInviteCopy | null {
  const tabela = persona === "tutor" ? COPY_TUTOR : COPY_PROFISSIONAL
  return tabela[status] ?? null
}

/** Existe convite a fazer para esta persona neste status? */
export function isPushInviteEligible(
  persona: PushInvitePersona,
  status: RequestStatus
): boolean {
  return resolvePushInviteCopy(persona, status) !== null
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispensa — "Agora não"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chave da dispensa, deliberadamente composta por persona + request + STATUS.
 *
 * Incluir o status é o que torna a regra honesta com o contrato V0: dispensar
 * em PENDING esconde o convite daquele momento, mas quando a solicitação for
 * aceita o momento operacional é OUTRO — e o produto pode oferecer de novo,
 * uma vez, com um benefício diferente. Sem o status na chave, um "agora não"
 * dado no primeiro minuto silenciaria o convite por todo o atendimento.
 *
 * Vive em `sessionStorage` (nunca `localStorage`): a dispensa dura a sessão de
 * trabalho, não vira preferência permanente — e não exige tabela nova.
 */
export function pushInviteDismissKey(
  persona: PushInvitePersona,
  requestId: string,
  status: RequestStatus
): string {
  return `peteen:push-invite:${persona}:${requestId}:${status}`
}
