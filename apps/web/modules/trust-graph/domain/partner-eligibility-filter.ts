/**
 * módulo: trust-graph
 * camada: domain
 *
 * SA-001 (Superaudit pré-piloto) — shape de `where` do Prisma que filtra
 * conexões de confiança cuja origem é um parceiro não elegível (não
 * verificado e/ou inativo — ver `modules/partners/domain/trust-eligibility.ts`
 * para a definição canônica de "elegível").
 *
 * Vive aqui, no domínio de trust-graph (dono do model `TrustConnection`),
 * e não no domínio de partners, porque o shape é sobre CONEXÃO — origem
 * TUTOR/PROFISSIONAL passa direto, só a origem PARTNER é restrita ao
 * parceiro elegível. `PARTNER_TRUST_ELIGIBLE_WHERE` (a definição do que
 * torna UM parceiro elegível) é importado de partners/domain, que é quem
 * possui essa regra.
 *
 * Só tipos são importados de `@prisma/client` (`import type`) — apagado
 * inteiramente na transpilação, então este arquivo não depende do driver
 * Prisma em runtime e roda sob `node --test` sem `DATABASE_URL`.
 */
import type { Prisma } from "@prisma/client"

// Caminho relativo com extensão .ts: mesmo padrão de imports cross-módulo
// já usado em outros arquivos de domínio deste repositório (ver
// service-request/domain/start-eligibility.ts), para rodar sob
// `node --experimental-strip-types --test` sem bundler.
import { PARTNER_TRUST_ELIGIBLE_WHERE } from "../../partners/domain/trust-eligibility.ts"

/**
 * Aplicar num `where` de `TrustConnection` (junto com `targetId`/`isActive`)
 * garante que:
 *   - conexões de origem TUTOR ou PROFESSIONAL passam direto — fora do
 *     escopo do SA-001;
 *   - conexões de origem PARTNER só contam se o parceiro satisfizer
 *     `PARTNER_TRUST_ELIGIBLE_WHERE` (verificado E ativo).
 *
 * Consumido por `getActiveConnectionsForProfessional` e
 * `getActiveConnectionsBatch` (trust-graph/infrastructure/repository.ts) —
 * o único ponto de leitura por trás de Trust Score, bônus de Recommendation
 * e badge `PARTNER_ENDORSED`. Corrigir aqui fecha os três de uma vez.
 */
export const ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS: Prisma.TrustConnectionWhereInput = {
  OR: [
    { sourceType: { not: "PARTNER" } },
    { sourceType: "PARTNER", sourcePartner: PARTNER_TRUST_ELIGIBLE_WHERE },
  ],
}
