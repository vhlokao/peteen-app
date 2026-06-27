/**
 * módulo: antifraude
 * camada: domain
 *
 * Constantes dos guardrails de antifraude MVP.
 * Todos os valores numéricos ficam aqui — nenhum magic number espalhado em actions.
 */

export const ANTIFRAUD_GUARDRAILS = {
  /** Janela mínima (horas) entre duas conclusões para o mesmo par tutor-profissional. */
  MIN_HOURS_BETWEEN_COMPLETIONS_SAME_PAIR: 24,

  /** Janela (dias) para detectar velocidade suspeita de recorrência. */
  ARTIFICIAL_RECURRENCE_WINDOW_DAYS: 30,

  /** Número de conclusões no período que dispara o FraudSignal de recorrência artificial. */
  ARTIFICIAL_RECURRENCE_COMPLETION_THRESHOLD: 8,

  /** Máximo de reviews que um profissional pode receber em 24 horas. */
  MAX_REVIEWS_RECEIVED_PER_PROFESSIONAL_24H: 20,

  /** Máximo de endossos ativos que um parceiro pode ter no MVP. */
  MAX_ACTIVE_PARTNER_ENDORSEMENTS_MVP: 10,

  /** Janela (horas) para deduplicar FraudSignal de recorrência artificial. */
  FRAUD_SIGNAL_DEDUP_WINDOW_HOURS: 168, // 7 dias
} as const
