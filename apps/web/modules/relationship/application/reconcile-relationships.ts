/**
 * módulo: relationship
 * camada: application
 *
 * reconcileRelationships — auditoria e reconciliação de
 * TutorProfessionalRelationship contra as fontes de verdade.
 *
 * Por que existe:
 *   Os contadores do relacionamento são valores materializados. Desde
 *   `completeServiceRequestAtomic`, a conclusão de atendimento é atômica e
 *   não pode mais gerar deriva — mas outros caminhos continuam podendo:
 *   REVIEW_GIVEN ainda é best-effort, dados semeados entram direto no banco,
 *   correções manuais acontecem, e registros históricos anteriores ao hook
 *   nunca foram contabilizados. Esta rotina é a rede de segurança e a
 *   observabilidade dessa classe de problema.
 *
 * Fontes de verdade (por par tutorId + professionalId):
 *   completedServices ← count(ServiceRequest status=COMPLETED)
 *   reviewsGiven      ← count(Review de requests do par)
 *   lastServiceAt     ← MAX(ServiceRequest.completedAt)
 *   relationshipScore ← computeRelationshipScore(contadores já reconciliados)
 *   relationshipLevel ← resolveRelationshipLevel(completedServices reconciliado)
 *
 *   firstServiceAt NÃO é reconciliado: por contrato ele registra a primeira
 *   conclusão OBSERVADA pelo vínculo (só é gravado quando está null e nunca
 *   é movido para frente), e não o mínimo histórico. Com dados semeados fora
 *   de ordem os dois divergem legitimamente. Reescrevê-lo aqui inventaria
 *   história. É reportado como informação, nunca corrigido.
 *
 *   cancelledByTutor / cancelledByPro / disputedServices também NÃO são
 *   reconciliados: nenhum fluxo os alimenta hoje (os tipos de evento existem
 *   em RelationshipEvent, mas nenhuma action os emite), então "corrigi-los"
 *   ligaria uma funcionalidade por via indireta. Ficam documentados como
 *   lacuna conhecida.
 *
 *   totalRequests NÃO é reconciliado, e não é por omissão: ele deixou de ser
 *   contador materializado. O total real é derivado de ServiceRequest na
 *   leitura (todas as statuses do par — ver `computeFallbackSummary` em
 *   relationship-history e `getAdminRelationships` no backoffice). A coluna
 *   segue no schema como legado, congelada, sem leitor e sem escritor.
 *   Reconciliá-la seria manter viva uma fonte de verdade duplicada — exatamente
 *   o que a decisão de derivar eliminou. Uma migration futura pode removê-la.
 *
 * Idempotente: rodar duas vezes seguidas em modo apply produz zero
 * divergências na segunda execução.
 *
 * NUNCA altera: Trust Score/Level, TrustEvent, Review, ServiceRequest,
 * FraudSignal. Só os campos materializados do próprio relacionamento.
 */

import { prisma } from "@/lib/prisma/client"
import {
  computeRelationshipScore,
  resolveRelationshipLevel,
} from "../domain/relationship-levels"

export type RelationshipDivergence = {
  relationshipId: string
  campo: "completedServices" | "reviewsGiven" | "lastServiceAt" | "relationshipScore" | "relationshipLevel"
  atual: string | number | null
  correto: string | number | null
}

export type ReconcileReport = {
  modo: "dry-run" | "apply"
  auditados: number
  divergentes: number
  corrigidos: number
  falhas: number
  divergencias: RelationshipDivergence[]
  /** Informativo, nunca corrigido — ver nota sobre firstServiceAt no topo. */
  observacoes: Array<{ relationshipId: string; nota: string }>
  erros: Array<{ relationshipId: string; erro: string }>
}

/**
 * @param apply  false (padrão) = dry run, não escreve nada.
 *               true = aplica as correções. Exige decisão explícita de quem chama.
 */
export async function reconcileRelationships(
  { apply = false }: { apply?: boolean } = {}
): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    modo: apply ? "apply" : "dry-run",
    auditados: 0,
    divergentes: 0,
    corrigidos: 0,
    falhas: 0,
    divergencias: [],
    observacoes: [],
    erros: [],
  }

  const rels = await prisma.tutorProfessionalRelationship.findMany({
    orderBy: { id: "asc" },
  })

  for (const rel of rels) {
    report.auditados++

    try {
      const chave = { tutorId: rel.tutorId, professionalId: rel.professionalId }

      const conclusoes = await prisma.serviceRequest.findMany({
        where: { ...chave, status: "COMPLETED" },
        select: { completedAt: true },
      })
      const completedServices = conclusoes.length

      const instantes = conclusoes
        .map((c) => c.completedAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())
      const lastServiceAt = instantes.length ? instantes[instantes.length - 1]! : null

      const reviewsGiven = await prisma.review.count({
        where: { request: chave },
      })

      // Derivados calculados a partir dos contadores JÁ reconciliados —
      // nunca dos valores persistidos, que podem estar defasados.
      const relationshipScore = computeRelationshipScore({
        completedServices,
        reviewsGiven,
        cancelledByTutor: rel.cancelledByTutor,
        cancelledByPro:   rel.cancelledByPro,
        disputedServices: rel.disputedServices,
      })
      const relationshipLevel = resolveRelationshipLevel(completedServices)

      const divergenciasDoRegistro: RelationshipDivergence[] = []
      const add = (
        campo: RelationshipDivergence["campo"],
        atual: string | number | null,
        correto: string | number | null
      ) => {
        if (String(atual) !== String(correto)) {
          divergenciasDoRegistro.push({ relationshipId: rel.id, campo, atual, correto })
        }
      }

      add("completedServices", rel.completedServices, completedServices)
      add("reviewsGiven", rel.reviewsGiven, reviewsGiven)
      add(
        "lastServiceAt",
        rel.lastServiceAt?.toISOString() ?? null,
        lastServiceAt?.toISOString() ?? null
      )
      add("relationshipScore", rel.relationshipScore, relationshipScore)
      add("relationshipLevel", rel.relationshipLevel, relationshipLevel)

      // firstServiceAt: só observação, nunca correção.
      const menorInstante = instantes.length ? instantes[0]! : null
      if (
        menorInstante &&
        rel.firstServiceAt &&
        rel.firstServiceAt.getTime() !== menorInstante.getTime()
      ) {
        report.observacoes.push({
          relationshipId: rel.id,
          nota: "firstServiceAt difere do MIN(completedAt) — esperado por contrato (primeira conclusao observada, nao minimo historico). Nao corrigido.",
        })
      }

      if (divergenciasDoRegistro.length === 0) continue

      report.divergentes++
      report.divergencias.push(...divergenciasDoRegistro)

      // Log estruturado, sem PII — só IDs técnicos e nomes de campo.
      console.warn("[reconcileRelationships] divergencia", {
        relationshipId: rel.id,
        campos: divergenciasDoRegistro.map((d) => d.campo),
      })

      if (!apply) continue

      await prisma.tutorProfessionalRelationship.update({
        where: { id: rel.id },
        data: {
          completedServices,
          reviewsGiven,
          lastServiceAt,
          relationshipScore,
          relationshipLevel,
        },
      })
      report.corrigidos++

      console.info("[reconcileRelationships] corrigido", {
        relationshipId: rel.id,
        campos: divergenciasDoRegistro.map((d) => d.campo),
      })
    } catch (err) {
      report.falhas++
      report.erros.push({ relationshipId: rel.id, erro: String(err) })
      console.error("[reconcileRelationships] falha", {
        relationshipId: rel.id,
        erro: String(err),
      })
    }
  }

  return report
}
