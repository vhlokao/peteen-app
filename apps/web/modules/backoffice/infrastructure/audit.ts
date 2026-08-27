/**
 * Módulo: backoffice
 * Camada: infrastructure — auditoria das recalculações de Trust
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE EXISTE
 *
 * `recalculateSingleTrustAction` e `recalculateAllTrustAction` exigem
 * `assertAdmin()`, mas gravavam `trustScore`/`trustLevel` sem deixar rastro:
 * o score de um profissional mudava e não havia como saber quem pediu, quando,
 * nem de quanto para quanto. Numa operação que alimenta Ranking e Discovery,
 * essa é a mutação que mais precisa ser explicável depois.
 *
 * Segue o mesmo formato dos demais `infrastructure/audit.ts` do projeto
 * (professional, pets, disputes, partner-portal…): helper fino sobre
 * `prisma.auditLog.create`, envolto em try/catch porque auditoria nunca deve
 * derrubar o fluxo principal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LIMITE ACEITO — O LOTE NÃO TEM LINHA DE RESUMO
 *
 * `AuditLog.entityId` é obrigatório, e a convenção real gravada no banco é
 * estrita: `entity` é sempre nome de model e `entityId` é o id de uma linha que
 * existe (conferido nas 22 combinações entity/action já presentes — nenhuma de
 * lote). Uma linha única para "recalculou todos" precisaria de um entityId
 * inventado (`"all"`, ou o id do próprio admin sob `entity: "ProfessionalProfile"`),
 * o que quebraria o índice `@@index([entity, entityId])` e a única invariante
 * que o AuditLog tem hoje.
 *
 * Então o lote é registrado pelo que ele REALMENTE fez: uma linha por
 * profissional efetivamente recalculado, cada uma corretamente endereçada. O
 * agrupamento vem de `loteId` no payload — a quantidade processada é a
 * contagem das linhas do mesmo lote, e não um número que alguém escreveu.
 *
 * Registrar uma linha de resumo exigiria `entityId` nulável no schema, que é
 * gate e está fora desta missão.
 */

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma/client"

/** Recalculação de UM profissional, pedida por um admin. */
export const TRUST_RECALC_SINGLE = "trust.recalculated"
/** Recalculação em lote — mesma ação, com `loteId` no payload. */
export const TRUST_RECALC_BATCH = "trust.recalculated_batch"

type ScoreSnapshot = {
  trustScore: number | null
  trustLevel?: string | null
}

/**
 * Uma linha de auditoria por profissional recalculado.
 *
 * `before`/`after` guardam só score e faixa — é exatamente o que mudou. O
 * detalhamento do cálculo (pesos, eventos, componentes) fica de fora de
 * propósito: não é necessário para explicar a operação e só engordaria a
 * tabela.
 */
export async function recordTrustRecalculationAudit(params: {
  adminId: string
  professionalId: string
  action: typeof TRUST_RECALC_SINGLE | typeof TRUST_RECALC_BATCH
  before: ScoreSnapshot
  after: ScoreSnapshot
  /** Presente apenas no lote — agrupa as linhas de uma mesma execução. */
  loteId?: string
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId:   params.adminId,
        action:   params.action,
        entity:   "ProfessionalProfile",
        entityId: params.professionalId,
        before:   params.before as Prisma.InputJsonValue,
        after:    {
          ...params.after,
          ...(params.loteId ? { loteId: params.loteId } : {}),
        } as Prisma.InputJsonValue,
      },
    })
  } catch {
    // Auditoria nunca derruba o fluxo principal — mesmo contrato dos demais
    // helpers de audit do projeto.
  }
}

/**
 * Auditoria de um lote inteiro, a partir do relatório que a recalculação já
 * produz. Só os profissionais REALMENTE atualizados entram: registrar um
 * "recalculado" para quem falhou seria afirmar uma mutação que não aconteceu.
 */
export async function recordTrustBatchAudit(params: {
  adminId: string
  loteId: string
  detalhes: Array<{
    professionalId: string
    previousScore: number
    newScore: number | null
    status: "updated" | "failed" | "skipped"
  }>
}): Promise<void> {
  for (const d of params.detalhes) {
    if (d.status !== "updated") continue
    await recordTrustRecalculationAudit({
      adminId:        params.adminId,
      professionalId: d.professionalId,
      action:         TRUST_RECALC_BATCH,
      before:         { trustScore: d.previousScore },
      after:          { trustScore: d.newScore },
      loteId:         params.loteId,
    })
  }
}

/**
 * Score e faixa atuais de um profissional.
 *
 * Existe para que a action possa fotografar o estado ANTES da mutação — depois
 * dela o valor anterior não sobrevive em lugar nenhum. Devolve `null` no score
 * se o profissional não existir, em vez de lançar: auditoria não pode ser o
 * motivo de uma recalculação legítima falhar.
 */
export async function getProfessionalTrustSnapshot(
  professionalId: string
): Promise<ScoreSnapshot> {
  try {
    const row = await prisma.professionalProfile.findUnique({
      where:  { id: professionalId },
      select: { trustScore: true, trustLevel: true },
    })
    return { trustScore: row?.trustScore ?? null, trustLevel: row?.trustLevel ?? null }
  } catch {
    return { trustScore: null, trustLevel: null }
  }
}
