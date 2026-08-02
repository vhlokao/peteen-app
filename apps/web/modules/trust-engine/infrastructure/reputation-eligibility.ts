/**
 * módulo: trust-engine
 * camada: infrastructure
 *
 * Elegibilidade de crédito reputacional por par (tutor → profissional).
 *
 * Por que existe:
 *   Operação e reputação são domínios separados. Um par tutor-profissional
 *   pode ter quantos atendimentos e avaliações reais quiser — isso é decisão
 *   deles, não do sistema. O que o sistema controla é quantas VEZES esse
 *   mesmo par move o Trust Score dentro de uma janela curta, porque é aí (e
 *   só aí) que mora o incentivo a conluio — e, no sentido oposto, a
 *   retaliação.
 *
 * Como decide:
 *   Consulta o próprio TrustEvent — a fonte de verdade do que já foi
 *   creditado — em vez de inferir de conclusões ou reviews brutas. Uma
 *   conclusão existir NÃO significa que ela gerou crédito (ex.: request não
 *   recorrente nunca emite RECURRENCE_COMPLETED), então usar o dado bruto
 *   como proxy de "já ganhou crédito" seria uma correlação falsa.
 *
 *   O par é identificado com segurança pelos campos que o próprio
 *   TrustEvent já persiste: `actorId` (User.id do tutor) e `targetId`
 *   (User.id do profissional). Nenhum campo novo, nenhuma migration.
 *
 * Grupos independentes (nunca compartilham janela):
 *   - Recorrência (COMPLETION_EVENT_TYPES): só crédito POSITIVO recente
 *     consome a janela. Não existe "recorrência negativa" — um evento de
 *     recorrência ou credita, ou não é emitido.
 *   - Reviews (REVIEW_EVENT_TYPES): QUALQUER review recente com peso
 *     diferente de 0 consome a janela, positiva ou negativa. A simetria é
 *     deliberada: limitar só o ganho positivo deixaria o empilhamento de
 *     avaliações negativas livre, abrindo um vetor de retaliação.
 *
 *   Uma review nunca bloqueia crédito de recorrência, e vice-versa — cada
 *   função abaixo fixa seu próprio conjunto de tipos, então o chamador não
 *   tem como misturar os grupos por engano.
 *
 * O que estas regras NUNCA fazem:
 *   - Bloquear aceite, início ou conclusão de um atendimento real.
 *   - Bloquear, apagar ou esconder uma review — ela é criada, fica visível,
 *     mantém rating/comentário e segue disponível para moderação e disputa.
 *     Só o efeito no Trust é neutralizado (peso 0).
 *   - Reduzir o que `detectArtificialRecurrence` enxerga (ele conta
 *     ServiceRequests COMPLETED, não TrustEvents — permanece intocado).
 *
 * Limitação conhecida (aceita para o MVP):
 *   Estas funções são check-then-write, NÃO oferecem atomicidade. Duas
 *   operações simultâneas do mesmo par podem ambas ler "sem crédito
 *   recente" e ambas creditar. Ver nota de concorrência no README da
 *   missão; fechar isso exigiria constraint única (migration) ou transação
 *   serializável, fora do escopo desta fase.
 */

import { prisma } from "@/lib/prisma/client"
import type { TrustEventType } from "@/modules/service-request/domain/types"
import {
  COMPLETION_EVENT_TYPES,
  REVIEW_EVENT_TYPES,
} from "../domain/constants"

/**
 * Que pesos contam como "a janela já foi consumida":
 *   - "positive": só peso > 0 (grupo recorrência)
 *   - "nonZero":  qualquer peso ≠ 0, positivo ou negativo (grupo review)
 *
 * Em ambos os casos peso 0 nunca conta — um evento neutralizado não pode
 * prolongar a janela, senão uma sequência de reviews a cada poucas horas
 * empurraria o relógio para sempre e nenhuma review voltaria a pontuar.
 */
type CreditedWeightRule = "positive" | "nonZero"

async function hasRecentCreditedEvent(params: {
  actorUserId: string
  targetUserId: string
  types: readonly TrustEventType[]
  windowHours: number
  weightRule: CreditedWeightRule
}): Promise<boolean> {
  const { actorUserId, targetUserId, types, windowHours, weightRule } = params
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000)

  const existing = await prisma.trustEvent.findFirst({
    where: {
      actorId: actorUserId,
      targetId: targetUserId,
      type: { in: types as TrustEventType[] },
      // Eventos flagados já não entram no cálculo do score, então também não
      // podem "consumir" a janela de crédito de um evento legítimo.
      isFlagged: false,
      createdAt: { gte: windowStart },
      ...(weightRule === "positive"
        ? { weight: { gt: 0 } }
        : { NOT: { weight: 0 } }),
    },
    select: { id: true },
  })

  return existing !== null
}

/**
 * Recorrência: o par pode receber no máximo um crédito
 * RECURRENCE_COMPLETED por janela. Só crédito positivo recente do MESMO
 * grupo consome a janela — reviews são irrelevantes aqui.
 */
export async function isRecurrenceCreditEligible(params: {
  actorUserId: string
  targetUserId: string
  windowHours: number
}): Promise<boolean> {
  const alreadyCredited = await hasRecentCreditedEvent({
    ...params,
    types: COMPLETION_EVENT_TYPES,
    weightRule: "positive",
  })
  return !alreadyCredited
}

/**
 * Reviews: dentro da janela, só a PRIMEIRA review do par influencia o
 * Trust — independentemente da nota. As seguintes são criadas, ficam
 * visíveis e auditáveis, mas entram com peso 0.
 *
 * Simétrico de propósito: qualquer review anterior com peso ≠ 0 (elogio ou
 * crítica) consome a janela. Créditos de recorrência são irrelevantes aqui.
 */
export async function isReviewCreditEligible(params: {
  actorUserId: string
  targetUserId: string
  windowHours: number
}): Promise<boolean> {
  const alreadyCounted = await hasRecentCreditedEvent({
    ...params,
    types: REVIEW_EVENT_TYPES,
    weightRule: "nonZero",
  })
  return !alreadyCounted
}
