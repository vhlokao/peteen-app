/**
 * módulo: antifraude
 * camada: domain
 *
 * Feature flags para bypass temporário de guardrails em ambiente de desenvolvimento.
 *
 * SEGURANÇA HARD-CODED:
 *   Mesmo que DEV_BYPASS_* esteja definido, a função retorna false
 *   quando NODE_ENV !== "development". Produção é imune por código, não por disciplina.
 *
 * Como usar (somente .env.local, nunca commitar):
 *   DEV_BYPASS_OPERATIONAL_GUARDRAILS=true   # desliga: duplicata ativa, IN_PROGRESS block
 *   DEV_BYPASS_ANTIFRAUD_GUARDRAILS=true     # desliga: bloqueio 24h início/conclusão
 *
 * Para reativar os guardrails: remova a linha do .env.local ou defina como "false".
 */

type GuardrailType = "operational" | "antifraud"

const ENV_KEYS: Record<GuardrailType, string> = {
  operational: "DEV_BYPASS_OPERATIONAL_GUARDRAILS",
  antifraud:   "DEV_BYPASS_ANTIFRAUD_GUARDRAILS",
}

/**
 * Retorna true somente quando:
 *   1. NODE_ENV === "development"
 *   2. A variável de ambiente correspondente === "true"
 *
 * Em production, retorna sempre false — independente de qualquer env var.
 */
export function isDevBypassEnabled(type: GuardrailType): boolean {
  if (process.env.NODE_ENV !== "development") return false
  return process.env[ENV_KEYS[type]] === "true"
}
