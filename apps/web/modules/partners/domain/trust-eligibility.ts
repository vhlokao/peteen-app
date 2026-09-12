/**
 * módulo: partners
 * camada: domain
 *
 * SA-001 (Superaudit pré-piloto) — um parceiro só pode produzir efeito de
 * confiança pública (Trust Score, bônus de Recommendation, badge
 * `PARTNER_ENDORSED`, "Recomendado por" no perfil do profissional) quando
 * estiver EXPLICITAMENTE verificado E ativo — nunca pelo simples fato de
 * existir ou de ter concluído o onboarding público.
 *
 * `isPartnerVerificationActive` (verification/domain/verification-state.ts)
 * já é o critério canônico de "verificado" (`isVerified && verificationStatus
 * === "VERIFIED"`). Este arquivo só adiciona a segunda metade da regra
 * (`isActive`) — o mesmo par que `/admin/partners` já usa para contar
 * `verifiedCount` (`p.isVerified && p.isActive`) — e expõe as duas formas
 * gêmeas do mesmo predicado:
 *   - `partnerIsTrustEligible`: JS puro, para quando a linha já foi
 *     carregada em memória;
 *   - `PARTNER_TRUST_ELIGIBLE_WHERE`: o mesmo critério como shape de `where`
 *     de relação do Prisma, para filtrar no próprio banco via JOIN (sem
 *     N+1, sem carregar linha inelegível para depois descartar em JS).
 *
 * As duas formas são travadas juntas por teste (`trust-eligibility.test.ts`)
 * para nunca divergirem — um novo campo de elegibilidade adicionado a uma
 * só das duas seria um bug silencioso.
 */

// Caminho relativo com extensão .ts: permite este módulo rodar sob
// `node --experimental-strip-types --test` sem bundler — mesmo padrão de
// service-request/domain/start-eligibility.ts para imports cross-módulo.
import { isPartnerVerificationActive } from "../../verification/domain/verification-state.ts"

export type PartnerTrustEligibility = {
  isVerified: boolean
  verificationStatus: string
  isActive: boolean
}

/** Forma pura — parceiro já carregado em memória. */
export function partnerIsTrustEligible(partner: PartnerTrustEligibility): boolean {
  return isPartnerVerificationActive(partner) && partner.isActive
}

/**
 * Shape gêmeo do predicado acima, para uso em `where` de relação do Prisma
 * (`sourcePartner: PARTNER_TRUST_ELIGIBLE_WHERE`). Mantido em sincronia com
 * `partnerIsTrustEligible` por teste dedicado.
 */
export const PARTNER_TRUST_ELIGIBLE_WHERE = {
  isVerified: true,
  verificationStatus: "VERIFIED",
  isActive: true,
} as const
