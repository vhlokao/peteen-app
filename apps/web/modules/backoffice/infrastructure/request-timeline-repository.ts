import "server-only"

/**
 * Módulo: backoffice
 * Camada: infrastructure — fatos brutos para a timeline operacional.
 *
 * Todas as leituras de UMA request. Rodam em paralelo (`Promise.all`) porque
 * são independentes entre si — em série, a página somaria cinco round-trips
 * sem nenhum ganho.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE NÃO É LIDO, DE PROPÓSITO
 *
 *   - `CareUpdate.content` → conteúdo de Diário (saúde, medicação, rotina da
 *     casa). A timeline operacional usa marcadores; o conteúdo tem superfície
 *     própria e dedicada logo abaixo na mesma página.
 *   - `CareMedia` em si → só a CONTAGEM por atualização. Carregar mídia numa
 *     lista significaria assinar URLs que ninguém vai abrir.
 *   - `AuditLog.ipAddress` / `userAgent` → dado de segurança pessoal, sem uso
 *     na reconstrução de "o que aconteceu com este atendimento".
 *   - `AuditLog.before` / `after` → payloads JSON arbitrários que podem conter
 *     qualquer campo da entidade, inclusive PII não relacionada.
 */

import { prisma } from "@/lib/prisma/client"

export type RequestTimelineFacts = {
  careUpdates: Array<{
    createdAt: Date
    occurredAt: Date
    category: string
    authorName: string | null
    editedAt: Date | null
    deletedAt: Date | null
    mediaCount: number
  }>
  auditLogs: Array<{ createdAt: Date; action: string; actorLabel: string | null }>
  disputes: Array<{
    createdAt: Date
    resolvedAt: Date | null
    reason: string
    status: string
  }>
}

const LIMITE_AUDIT = 100
const LIMITE_CARE = 100

export async function getRequestTimelineFacts(
  requestId: string
): Promise<RequestTimelineFacts> {
  const [careUpdates, auditLogs, disputes] = await Promise.all([
    prisma.careUpdate.findMany({
      where: { requestId },
      select: {
        createdAt: true,
        occurredAt: true,
        category: true,
        editedAt: true,
        deletedAt: true,
        professional: { select: { displayName: true } },
        // `_count` resolve a contagem de mídia no MESMO round-trip — a
        // alternativa (uma consulta de CareMedia por atualização) seria N+1
        // num laço que cresce com o atendimento.
        _count: { select: { media: true } },
      },
      orderBy: { createdAt: "asc" },
      take: LIMITE_CARE,
    }),

    // Filtrado por entidade: o AuditLog inteiro tem centenas de linhas sem
    // relação com esta request, e carregá-lo para depois filtrar em memória
    // seria caro e cresceria sem teto.
    prisma.auditLog.findMany({
      where: { entityId: requestId },
      select: {
        createdAt: true,
        action: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "asc" },
      take: LIMITE_AUDIT,
    }),

    prisma.dispute.findMany({
      where: { requestId },
      select: { createdAt: true, resolvedAt: true, reason: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  return {
    careUpdates: careUpdates.map((u) => ({
      createdAt: u.createdAt,
      occurredAt: u.occurredAt,
      category: u.category,
      authorName: u.professional?.displayName ?? null,
      editedAt: u.editedAt,
      deletedAt: u.deletedAt,
      mediaCount: u._count.media,
    })),
    auditLogs: auditLogs.map((a) => ({
      createdAt: a.createdAt,
      action: a.action,
      actorLabel: a.user?.email ?? null,
    })),
    disputes,
  }
}
