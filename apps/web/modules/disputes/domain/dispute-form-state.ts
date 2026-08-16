/**
 * Módulo: disputes
 * Camada: domain — estado "sujo" do formulário de disputa (R2B.2 hardening).
 *
 * Extraído para cá porque virou uma decisão de negócio, não só UI: até este
 * hardening, `DisputeForm` suspendia o auto-sync incondicionalmente
 * (`useSuspendAutoRefreshWhileEditing(true)`) só por estar montado — um
 * tutor que abria "Reportar problema" para ler as opções e saía sem digitar
 * nada travava a tela em estado desatualizado indefinidamente. A regra
 * correta é: sujo é ter DIVERGIDO do estado inicial, não estar aberto.
 */

import type { DisputeReason } from "./types"

export function isDisputeFormDirty(
  reason: DisputeReason,
  initialReason: DisputeReason,
  description: string
): boolean {
  return reason !== initialReason || description.trim().length > 0
}
