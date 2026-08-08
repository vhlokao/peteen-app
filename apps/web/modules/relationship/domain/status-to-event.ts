/**
 * módulo: relationship
 * camada: domain — função pura
 *
 * Mapeia um status TERMINAL de ServiceRequest para o RelationshipEvent
 * correspondente, quando existe um contador materializado para ele.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 * `cancelledByTutor` e `cancelledByPro` existiam no schema e em
 * `applyRelationshipEvent` desde o início, mas nenhum fluxo emitia os eventos
 * — a auditoria pré-piloto confirmou drift real (3 pares com cancelamento de
 * tutor e 1 com cancelamento de profissional, todos com contador 0). Esta
 * função é o elo que faltava, isolado aqui para ser testável sem banco.
 *
 * ── O que NÃO mapeamos, e por quê ─────────────────────────────────────────
 * `COMPLETED` não entra aqui: a conclusão tem caminho próprio e atômico
 * (`completeServiceRequestAtomic`), que também grava `lastServiceAt`,
 * `firstServiceAt` e os derivados. Duplicar aqui causaria incremento duplo.
 *
 * `EXPIRED` não tem contador no relacionamento — expirar é ausência de
 * resposta, não um ato de nenhuma das partes. Não inventamos um contador.
 *
 * `DISPUTED` está deliberadamente FORA. O status `DISPUTED` de ServiceRequest
 * é inalcançável por construção: `VALID_TRANSITIONS` não tem nenhuma aresta
 * para ele e o comentário do próprio contrato diz que disputa é uma entidade
 * separada (`Dispute`) que coexiste com a request, deixando o status no
 * estado anterior. Mapear `DISPUTED` aqui seria criar código morto; alimentar
 * `disputedServices` exige decidir a fonte de verdade (tabela `Dispute`), o
 * que é uma decisão de produto pendente — ver entrega da missão.
 */

import type { RelationshipEvent } from "./types"

/**
 * Retorna o evento de relacionamento para o status de destino, ou `null`
 * quando aquele status não alimenta nenhum contador materializado.
 *
 * Só deve ser chamada DEPOIS de a transição ter sido efetivamente aplicada
 * (ou seja, depois do guard idempotente de `fromStatus`): um retry que não
 * muda nada não pode produzir incremento.
 */
export function relationshipEventForStatus(status: string): RelationshipEvent | null {
  switch (status) {
    case "CANCELLED_BY_TUTOR":
      return { type: "CANCELLATION_BY_TUTOR" }
    case "CANCELLED_BY_PROFESSIONAL":
      return { type: "CANCELLATION_BY_PRO" }
    default:
      return null
  }
}
