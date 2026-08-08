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
 *   cancelledByTutor ← count(ServiceRequest status=CANCELLED_BY_TUTOR)
 *   cancelledByPro   ← count(ServiceRequest status=CANCELLED_BY_PROFESSIONAL)
 *
 *   Estes dois passaram a ter writer conectado (ver
 *   relationship/domain/status-to-event.ts, aplicado dentro da transação da
 *   transição de status). Registros anteriores à conexão continuam defasados —
 *   é esse drift histórico que a reconciliação corrige.
 *
 *   disputedServices ← requests DISTINTAS do par com ao menos uma Dispute
 *
 *   Fonte é `Dispute ⋈ ServiceRequest`, NUNCA COUNT(status='DISPUTED'): esse
 *   status é inalcançável por construção (não há aresta para ele em
 *   VALID_TRANSITIONS — disputa é a entidade `Dispute`, que coexiste com a
 *   request e deixa o status no estado anterior). Contar por status daria 0
 *   sempre e mascararia disputas reais.
 *
 *   Conta REQUESTS, não linhas de Dispute: não há unique em
 *   `Dispute.requestId` e o guard do fluxo do tutor bloqueia apenas disputas
 *   ATIVAS, então uma request pode acumular várias disputas ao longo do tempo.
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
  campo:
    | "completedServices"
    | "reviewsGiven"
    | "cancelledByTutor"
    | "cancelledByPro"
    | "disputedServices"
    | "lastServiceAt"
    | "relationshipScore"
    | "relationshipLevel"
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

      // Contadores de cancelamento — fonte de verdade é o status da própria
      // ServiceRequest. Passaram a ter writer conectado (ver
      // relationship/domain/status-to-event.ts), mas registros anteriores a
      // essa conexão continuam defasados: é exatamente o drift que esta rotina
      // corrige.
      const cancelledByTutor = await prisma.serviceRequest.count({
        where: { ...chave, status: "CANCELLED_BY_TUTOR" },
      })
      const cancelledByPro = await prisma.serviceRequest.count({
        where: { ...chave, status: "CANCELLED_BY_PROFESSIONAL" },
      })

      // `disputedServices` = requests DISTINTAS do par com ao menos uma
      // disputa. Fonte: Dispute ⋈ ServiceRequest — NÃO
      // COUNT(status='DISPUTED'), que seria sempre 0 porque esse status é
      // inalcançável por contrato (disputa é entidade separada que coexiste
      // com a request).
      //
      // Conta requests, não linhas de Dispute: uma request pode acumular
      // várias disputas (sem unique em Dispute.requestId; o guard do fluxo do
      // tutor bloqueia só disputas ATIVAS, então uma RESOLVED/REJECTED não
      // impede abrir outra). Contar linhas inflaria o número de serviços
      // disputados.
      const requestsComDisputa = await prisma.serviceRequest.count({
        where: { ...chave, disputes: { some: {} } },
      })
      const disputedServices = requestsComDisputa

      // Derivados calculados a partir dos contadores JÁ reconciliados —
      // nunca dos valores persistidos, que podem estar defasados.
      //
      // `disputedServices` é reconciliado (acima) mas NÃO entra no score:
      // corrigir o contador de disputas não mexe em `relationshipScore`. Isso
      // é o ponto central da decisão — histórico operacional é registrado,
      // culpa reputacional não é presumida (ver constants.ts).
      const relationshipScore = computeRelationshipScore({
        completedServices,
        reviewsGiven,
        cancelledByTutor,
        cancelledByPro,
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
      add("cancelledByTutor", rel.cancelledByTutor, cancelledByTutor)
      add("cancelledByPro", rel.cancelledByPro, cancelledByPro)
      add("disputedServices", rel.disputedServices, disputedServices)
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
          cancelledByTutor,
          cancelledByPro,
          disputedServices,
          lastServiceAt,
          relationshipScore,
          relationshipLevel,
          // `totalRequests` NUNCA entra aqui — coluna legada congelada por
          // contrato, derivada na leitura.
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
