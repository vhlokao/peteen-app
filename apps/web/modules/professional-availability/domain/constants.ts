/**
 * Módulo: professional-availability
 * Camada: domain — constantes de dias da semana (MVP 7.6)
 *
 * weekday: 0 = Segunda … 6 = Domingo (ordem de exibição PT-BR)
 */

export const WEEKDAY_DEFINITIONS = [
  { weekday: 0, label: "Segunda-feira", shortLabel: "Segunda-feira" },
  { weekday: 1, label: "Terça-feira", shortLabel: "Terça-feira" },
  { weekday: 2, label: "Quarta-feira", shortLabel: "Quarta-feira" },
  { weekday: 3, label: "Quinta-feira", shortLabel: "Quinta-feira" },
  { weekday: 4, label: "Sexta-feira", shortLabel: "Sexta-feira" },
  { weekday: 5, label: "Sábado", shortLabel: "Sábado" },
  { weekday: 6, label: "Domingo", shortLabel: "Domingo" },
] as const

export const WEEKDAY_LABELS: Record<number, string> = Object.fromEntries(
  WEEKDAY_DEFINITIONS.map((d) => [d.weekday, d.label])
)

export const DEFAULT_START_TIME = "09:00"
export const DEFAULT_END_TIME = "18:00"

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
