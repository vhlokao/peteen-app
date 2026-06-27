/**
 * módulo: service-request
 * camada: domain
 *
 * Constantes operacionais de guardrails de fluxo de serviço.
 * Separam regras de negócio operacionais das regras de antifraude reputacional.
 */

import type { RequestStatus } from "./types"

/**
 * Status que indicam uma solicitação ativa (não pode criar outra para o mesmo par).
 * Qualquer request nestes estados bloqueia a criação de novo request para o mesmo par.
 */
export const ACTIVE_REQUEST_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
] as const satisfies readonly RequestStatus[]

/**
 * Status terminais — solicitação encerrada, novo request pode ser criado.
 */
export const TERMINAL_REQUEST_STATUSES = [
  "COMPLETED",
  "CANCELLED_BY_TUTOR",
  "CANCELLED_BY_PROFESSIONAL",
  "DISPUTED",
  "EXPIRED",
] as const satisfies readonly RequestStatus[]
