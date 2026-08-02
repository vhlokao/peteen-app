/**
 * módulo: trust-engine
 * camada: domain
 *
 * Janela de crédito reputacional — fonte única para os três consumidores:
 *   1. bônus de recorrência derivado (calculate-trust-score)
 *   2. crédito RECURRENCE_COMPLETED (completeServiceRequestAction)
 *   3. crédito de review (createReviewAction)
 *
 * Dentro desta janela, um mesmo par tutor-profissional move o Trust Score no
 * máximo uma vez POR GRUPO de evento — recorrência e review têm janelas
 * lógicas independentes, uma nunca consome a da outra.
 *
 * Nada é bloqueado operacionalmente por causa dela: atendimentos são aceitos,
 * iniciados e concluídos normalmente, e reviews são criadas e ficam visíveis.
 * O que a janela limita é só o CRÉDITO.
 *
 * Fica em arquivo próprio (e não em ./constants.ts) porque importa um valor
 * de outro módulo; constants.ts precisa permanecer livre de imports de
 * runtime para continuar carregável pela suíte pura de scoring.
 */

import { ANTIFRAUD_GUARDRAILS } from "@/modules/antifraude/domain/constants"

export const REPUTATION_CREDIT_WINDOW_HOURS =
  ANTIFRAUD_GUARDRAILS.MIN_HOURS_BETWEEN_COMPLETIONS_SAME_PAIR

export const REPUTATION_CREDIT_WINDOW_MS =
  REPUTATION_CREDIT_WINDOW_HOURS * 60 * 60 * 1000
