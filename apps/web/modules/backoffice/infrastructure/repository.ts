/**
 * módulo: backoffice
 * camada: infrastructure
 *
 * Queries de leitura para o Backoffice Admin.
 *
 * Regras:
 *   - Somente leitura — sem mutações aqui
 *   - Sem verificação de auth — responsabilidade da camada application/layout
 *   - Retorna tipos de domínio do backoffice
 *   - Queries devem ser eficientes — não levar mais de 1s para volumes normais
 */

import { prisma } from "@/lib/prisma/client"
import type {
  AdminDashboardMetrics,
  AdminUserRow,
  AdminTutorRow,
  AdminProfessionalRow,
  AdminRequestRow,
  AdminReviewRow,
  AdminTrustRow,
  AdminRelationshipRow,
  AdminFlagRow,
  AdminDisputeRow,
  AdminAuditRow,
  AdminRiskRow,
  AdminUsersFilter,
  AdminRequestsFilter,
  AdminRelationshipsFilter,
  AdminFlagsFilter,
  AdminDisputesFilter,
  AdminAuditFilter,
} from "../domain/types"
import { calculateAllRiskScores } from "@/modules/antifraude/application/calculate-risk-score"
import {
  coletarEmLotes,
  isOperationalStatusFilter,
  matchesOperationalStatus,
  pendingExpiryCandidateWindow,
  type OperationalStatusFilter,
} from "../domain/request-operational-status"

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contagem do dashboard com tolerância ESTREITA — GATE-14.
 *
 * O que existia: `catch { return 0 }`, cego e silencioso. O comentário dizia
 * proteger um caso específico de desenvolvimento (delegate ausente no client
 * Prisma em cache depois de um hot-reload), mas o catch engolia TUDO. Um banco
 * fora do ar em produção não derrubava a tela — pintava um dashboard inteiro de
 * zeros: "Total de usuários: 0", "Solicitações: 0". Números de negócio
 * afirmados com confiança a partir de uma falha, que é pior que erro nenhum:
 * ninguém desconfia de um zero.
 *
 * Agora só o caso que o comentário descreve é tolerado. `TypeError` é a forma
 * do delegate inexistente (`prisma.algo.count is not a function`) e continua
 * caindo em 0 para não travar o desenvolvimento — mas AGORA aparece no log, em
 * vez de sumir. Qualquer outro erro (Prisma, rede, timeout) sobe para
 * `app/(admin)/admin/error.tsx`, que sabe dizer "falhou ao carregar".
 */
async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof TypeError) {
      console.warn("[admin] contagem indisponível (delegate ausente)", {
        erro: String(err.message).slice(0, 120),
      })
      return 0
    }
    throw err
  }
}

export async function getDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    totalTutors,
    totalProfessionals,
    totalPets,
    totalRequests,
    pendingRequests,
    completedRequests,
    totalReviews,
    trustAggregate,
    professionalsWithStaleScore,
    recurringRelationships,
    openFlags,
    openDisputes,
    hiddenReviews,
    activeTrustConnections,
    activePartners,
    verifiedPartners,
    professionalsRecommendedByPartners,
  ] = await Promise.all([
    safeCount(() => prisma.user.count({ where: { deletedAt: null } })),
    safeCount(() => prisma.tutorProfile.count({ where: { deletedAt: null } })),
    safeCount(() => prisma.professionalProfile.count({ where: { deletedAt: null } })),
    safeCount(() => prisma.pet.count({ where: { deletedAt: null } })),
    safeCount(() => prisma.serviceRequest.count()),
    safeCount(() => prisma.serviceRequest.count({ where: { status: "PENDING" } })),
    safeCount(() => prisma.serviceRequest.count({ where: { status: "COMPLETED" } })),
    safeCount(() => prisma.review.count()),
    prisma.professionalProfile.aggregate({
      _avg: { trustScore: true },
      where: { deletedAt: null },
    }).catch(() => ({ _avg: { trustScore: 0 } })),
    safeCount(() => prisma.professionalProfile.count({
      where: {
        deletedAt: null,
        OR: [
          { trustUpdatedAt: null },
          { trustUpdatedAt: { lt: oneDayAgo } },
        ],
      },
    })),
    safeCount(() => prisma.tutorProfessionalRelationship.count({
      where: { relationshipLevel: { in: ["RECURRING", "TRUSTED", "PARTNER"] } },
    })),
    // Etapa 5.5 — fallback defensivo: retorna 0 se o client antigo não tiver o delegate
    safeCount(() => prisma.operationalFlag.count({ where: { status: "OPEN" } })),
    safeCount(() => prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } })),
    safeCount(() => prisma.review.count({ where: { hiddenByAdmin: true } })),
    // Etapa 5.8 — Trust Graph
    safeCount(() => prisma.trustConnection.count({ where: { isActive: true } })),
    // Etapa 5.9 — Parceiros
    safeCount(() => prisma.partner.count({ where: { isActive: true } })),
    safeCount(() => prisma.partner.count({ where: { isActive: true, isVerified: true } })),
    safeCount(() =>
      prisma.trustConnection.groupBy({
        by: ["targetId"],
        where: {
          connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
          isActive: true,
        },
      }).then((rows) => rows.length)
    ),
  ])

  return {
    totalUsers,
    totalTutors,
    totalProfessionals,
    totalPets,
    totalRequests,
    pendingRequests,
    completedRequests,
    totalReviews,
    averageTrustScore: Math.round(trustAggregate._avg.trustScore ?? 0),
    professionalsWithStaleScore,
    recurringRelationships,
    openFlags,
    openDisputes,
    hiddenReviews,
    activeTrustConnections,
    activePartners,
    verifiedPartners,
    professionalsRecommendedByPartners,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminUsers(
  filter: AdminUsersFilter = {}
): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(filter.email
        ? { email: { contains: filter.email, mode: "insensitive" } }
        : {}),
    },
    select: {
      id: true,
      email: true,
      activePrimaryRole: true,
      createdAt: true,
      onboardingCompletedAt: true,
      lastSeenAt: true,
      tutorProfile:        { select: { id: true } },
      professionalProfile: { select: { id: true } },
      partnerProfile:      { select: { id: true } },
      adminProfile:        { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return users
    .map((u) => {
      const roles: string[] = []
      if (u.tutorProfile)        roles.push("TUTOR")
      if (u.professionalProfile) roles.push("PROFESSIONAL")
      if (u.partnerProfile)      roles.push("PARTNER")
      if (u.adminProfile)        roles.push("ADMIN")

      // Filtra por role se especificado
      if (filter.role && !roles.includes(filter.role)) return null

      return {
        id:                   u.id,
        email:                u.email,
        roles,
        activePrimaryRole:    u.activePrimaryRole ?? null,
        createdAt:            u.createdAt,
        onboardingCompletedAt: u.onboardingCompletedAt,
        lastSeenAt:           u.lastSeenAt,
      }
    })
    .filter(Boolean) as AdminUserRow[]
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTORS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminTutors(): Promise<AdminTutorRow[]> {
  const tutors = await prisma.tutorProfile.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      displayName: true,
      city: true,
      state: true,
      createdAt: true,
      _count: {
        select: {
          pets:     true,
          requests: true,
          reviews:  true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return tutors.map((t) => ({
    id:           t.id,
    displayName:  t.displayName,
    city:         t.city,
    state:        t.state,
    petCount:     t._count.pets,
    requestCount: t._count.requests,
    reviewCount:  t._count.reviews,
    createdAt:    t.createdAt,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONALS
// ─────────────────────────────────────────────────────────────────────────────

type RawReviewStat = {
  professionalId: string
  count:          bigint
  avgRating:      number | null
}

type RawRelStat = {
  professionalId:  string
  totalCompleted:  bigint
  recurringCount:  bigint
}

export async function getAdminProfessionals(): Promise<AdminProfessionalRow[]> {
  const [professionals, reviewStats, relStats] = await Promise.all([
    prisma.professionalProfile.findMany({
      where: { deletedAt: null },
      select: {
        id:            true,
        displayName:   true,
        city:          true,
        state:         true,
        serviceTypes:  true,
        trustScore:    true,
        trustLevel:    true,
        trustUpdatedAt: true,
        createdAt:     true,
      },
      orderBy: { trustScore: "desc" },
      take: 200,
    }),

    // Review count e média via raw SQL (Review não tem professionalId direto)
    // Nota: Prisma usa camelCase nas colunas — todos os nomes entre aspas duplas
    prisma.$queryRaw<RawReviewStat[]>`
      SELECT
        sr."professionalId"  AS "professionalId",
        COUNT(r.id)          AS count,
        AVG(r.rating)        AS "avgRating"
      FROM reviews r
      JOIN service_requests sr ON r."requestId" = sr.id
      GROUP BY sr."professionalId"
    `,

    // Relacionamentos: total completado e qtd de clientes recorrentes
    prisma.$queryRaw<RawRelStat[]>`
      SELECT
        "professionalId"                                                                          AS "professionalId",
        SUM("completedServices")                                                                  AS "totalCompleted",
        COUNT(CASE WHEN "relationshipLevel" IN ('RECURRING','TRUSTED','PARTNER') THEN 1 END)     AS "recurringCount"
      FROM tutor_professional_relationships
      GROUP BY "professionalId"
    `,
  ])

  const reviewMap = new Map(
    reviewStats.map((s) => [
      s.professionalId,
      { count: Number(s.count), avg: s.avgRating ? Number(s.avgRating) : null },
    ])
  )

  const relMap = new Map(
    relStats.map((s) => [
      s.professionalId,
      { total: Number(s.totalCompleted), recurring: Number(s.recurringCount) },
    ])
  )

  return professionals.map((p) => {
    const rev = reviewMap.get(p.id)
    const rel = relMap.get(p.id)
    return {
      id:               p.id,
      displayName:      p.displayName,
      city:             p.city,
      state:            p.state,
      serviceTypes:     p.serviceTypes,
      trustScore:       p.trustScore,
      trustLevel:       p.trustLevel,
      trustUpdatedAt:   p.trustUpdatedAt,
      reviewCount:      rev?.count ?? 0,
      averageRating:    rev?.avg ?? null,
      completedServices: rel?.total ?? 0,
      recurringClients:  rel?.recurring ?? 0,
      createdAt:        p.createdAt,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FILTRO POR STATUS OPERACIONAL — GATE-14-...-FIX-002
 *
 * `PENDING` e `EXPIRED` deixaram de ser lidos da coluna. O que a tela mostra e
 * o que o filtro seleciona passaram a ser a MESMA pergunta, respondida pela
 * mesma função.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO É `take: 300` SEGUIDO DE FILTRO
 *
 * O refino em memória só REMOVE linhas. Buscar 300 candidatos e descartar 40
 * devolveria 260 — escondendo solicitações válidas e MAIS ANTIGAS que existiam
 * logo depois do corte. Numa tela de investigação, omitir o registro antigo é
 * exatamente perder o caso que se está procurando.
 *
 * Então a busca é em LOTES com cursor: lê, refina, e volta ao banco enquanto
 * não completou o limite e ainda houver fonte. O `take` deixa de ser o teto do
 * que pode ser examinado e passa a ser o teto do que é devolvido.
 */

/** Teto de linhas devolvidas à tela. Era o `take: 300` literal. */
const ADMIN_REQUESTS_LIMITE = 300

/**
 * Tamanho do lote na busca por candidatos. Não é o teto da resposta — é quanto
 * se lê por ida ao banco enquanto o refino em memória descarta falsos positivos.
 */
const ADMIN_REQUESTS_LOTE = 300

/**
 * Teto de idas ao banco. Trava de segurança, não parte do algoritmo: com o
 * predicado de candidatos sendo quase exato (ver `pendingExpiryCandidateWindow`),
 * a primeira volta basta em qualquer base realista. Existe para que um erro
 * futuro no predicado vire lista curta, nunca laço infinito.
 */
const ADMIN_REQUESTS_MAX_LOTES = 20

const ADMIN_REQUEST_SELECT = {
  id:          true,
  serviceType: true,
  status:      true,
  scheduledAt: true,
  scheduledHasTime: true,
  startedAt:   true,
  completedAt: true,
  createdAt:   true,
  tutor:       { select: { displayName: true } },
  professional:{ select: { displayName: true } },
  pet:         { select: { name: true } },
} as const

/**
 * Ordem estável para paginar por cursor.
 *
 * `createdAt` sozinho não é único — duas solicitações criadas no mesmo
 * milissegundo teriam ordem indefinida entre lotes, e uma delas poderia ser
 * pulada ou repetida na virada do cursor. O `id` desempata.
 */
const ADMIN_REQUESTS_ORDER = [
  { createdAt: "desc" },
  { id: "desc" },
] as const

/**
 * Candidatos que o BANCO consegue pré-selecionar para cada filtro operacional.
 *
 * Os dois são superconjuntos deliberados — quem decide de verdade é
 * `matchesOperationalStatus`, com a regra oficial. Ver a prova caso a caso em
 * `pendingExpiryCandidateWindow`.
 */
function whereCandidatos(
  filtro: OperationalStatusFilter,
  agora: Date,
  desde: Date | undefined
) {
  const janela = pendingExpiryCandidateWindow(agora)

  if (filtro === "PENDING") {
    // Operacionalmente pendente ⟹ ainda não venceu por idade. O contrapositivo
    // é seguro: passou de 24h da criação, venceu — com ou sem agendamento.
    return {
      status: { equals: "PENDING" as never },
      createdAt: { gt: janela.createdAtAteh, ...(desde ? { gte: desde } : {}) },
    }
  }

  // EXPIRED: as já gravadas MAIS as PENDING candidatas a vencidas.
  return {
    ...(desde ? { createdAt: { gte: desde } } : {}),
    OR: [
      { status: { equals: "EXPIRED" as never } },
      {
        status: { equals: "PENDING" as never },
        OR: [
          { createdAt: { lte: janela.createdAtAteh } },
          { scheduledAt: { lte: janela.scheduledAtAteh } },
        ],
      },
    ],
  }
}

async function buscarPorStatusOperacional(
  filtro: OperationalStatusFilter,
  comuns: Record<string, unknown>,
  desde: Date | undefined
) {
  const agora = new Date()
  const where = { ...comuns, ...whereCandidatos(filtro, agora, desde) }

  return coletarEmLotes({
    lerLote: (depoisDe) =>
      prisma.serviceRequest.findMany({
        where,
        select: ADMIN_REQUEST_SELECT,
        orderBy: [...ADMIN_REQUESTS_ORDER],
        take: ADMIN_REQUESTS_LOTE,
        ...(depoisDe ? { cursor: { id: depoisDe }, skip: 1 } : {}),
      }),
    // A decisão é do domínio. Esta camada não sabe o que "vencida" significa.
    aceita: (linha) => matchesOperationalStatus(linha, filtro, agora),
    idDe: (linha) => linha.id,
    limite: ADMIN_REQUESTS_LIMITE,
    tamanhoDoLote: ADMIN_REQUESTS_LOTE,
    maxLotes: ADMIN_REQUESTS_MAX_LOTES,
  })
}

export async function getAdminRequests(
  filter: AdminRequestsFilter = {}
): Promise<AdminRequestRow[]> {
  // Recorte temporal por `createdAt`. Sem ele, "Hoje" e "Últimos 7 dias"
  // teriam que ser filtrados em memória depois do `take`, o que devolveria
  // resultado errado assim que a base passar de 300 solicitações.
  const desde =
    filter.dias && filter.dias > 0
      ? new Date(Date.now() - filter.dias * 24 * 60 * 60 * 1000)
      : undefined

  const operacional = isOperationalStatusFilter(filter.status)

  /** Filtros que não dependem do status. Valem para os dois caminhos. */
  const comuns = {
    ...(filter.serviceType ? { serviceType: { equals: filter.serviceType as never } } : {}),
    // `startsWith` e não `equals`: a lista exibe os 8 primeiros caracteres do
    // id, e é esse prefixo que alguém copia de um relato de incidente.
    ...(filter.requestId ? { id: { startsWith: filter.requestId } } : {}),
  }

  const requests = operacional
    ? await buscarPorStatusOperacional(filter.status as OperationalStatusFilter, comuns, desde)
    : await prisma.serviceRequest.findMany({
        where: {
          ...comuns,
          ...(filter.status ? { status: { equals: filter.status as never } } : {}),
          ...(desde ? { createdAt: { gte: desde } } : {}),
        },
        select: ADMIN_REQUEST_SELECT,
        orderBy: [...ADMIN_REQUESTS_ORDER],
        take: ADMIN_REQUESTS_LIMITE,
      })

  return requests.map((r) => ({
    id:               r.id,
    tutorName:        r.tutor.displayName,
    professionalName: r.professional.displayName,
    petName:          r.pet?.name ?? null,
    serviceType:      r.serviceType,
    status:           r.status,
    scheduledAt:      r.scheduledAt,
    scheduledHasTime: r.scheduledHasTime,
    createdAt:        r.createdAt,
    startedAt:        r.startedAt,
    completedAt:      r.completedAt,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminReviews(): Promise<AdminReviewRow[]> {
  const reviews = await prisma.review.findMany({
    select: {
      id:            true,
      rating:        true,
      comment:       true,
      serviceType:   true,
      petContext:    true,
      isVisible:     true,
      isFlagged:     true,
      hiddenByAdmin: true,
      hiddenReason:  true,
      createdAt:     true,
      tutor: { select: { displayName: true } },
      request: {
        select: {
          professional: { select: { displayName: true } },
        },
      },
    },
    orderBy: [
      { hiddenByAdmin: "desc" },
      { isFlagged: "desc" },
      { createdAt: "desc" },
    ],
    take: 300,
  })

  return reviews.map((r) => {
    const ctx = r.petContext as { species?: string } | null
    return {
      id:               r.id,
      tutorName:        r.tutor.displayName,
      professionalName: r.request.professional.displayName,
      rating:           r.rating,
      comment:          r.comment,
      serviceType:      r.serviceType,
      petSpecies:       ctx?.species ?? "—",
      isVisible:        r.isVisible,
      isFlagged:        r.isFlagged,
      hiddenByAdmin:    r.hiddenByAdmin,
      hiddenReason:     r.hiddenReason,
      createdAt:        r.createdAt,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST
// ─────────────────────────────────────────────────────────────────────────────

type RawTrustStat = {
  professionalId:   string
  count:            bigint
  totalCompleted:   bigint
}

export async function getAdminTrustData(): Promise<AdminTrustRow[]> {
  const [professionals, reviewStats] = await Promise.all([
    prisma.professionalProfile.findMany({
      where: { deletedAt: null },
      select: {
        id:             true,
        displayName:    true,
        city:           true,
        trustScore:     true,
        trustLevel:     true,
        trustUpdatedAt: true,
      },
      orderBy: { trustScore: "desc" },
      take: 300,
    }),

    prisma.$queryRaw<RawTrustStat[]>`
      SELECT
        sr."professionalId"                                                       AS "professionalId",
        COUNT(r.id)                                                               AS count,
        SUM(CASE WHEN sr.status = 'COMPLETED' THEN 1 ELSE 0 END)                 AS "totalCompleted"
      FROM service_requests sr
      LEFT JOIN reviews r ON r."requestId" = sr.id
      GROUP BY sr."professionalId"
    `,
  ])

  const statsMap = new Map(
    reviewStats.map((s) => [s.professionalId, s])
  )

  return professionals.map((p) => {
    const s = statsMap.get(p.id)
    return {
      id:               p.id,
      displayName:      p.displayName,
      city:             p.city,
      trustScore:       p.trustScore,
      trustLevel:       p.trustLevel,
      trustUpdatedAt:   p.trustUpdatedAt,
      reviewCount:      s ? Number(s.count) : 0,
      completedServices: s ? Number(s.totalCompleted) : 0,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminRelationships(
  filter: AdminRelationshipsFilter = {}
): Promise<AdminRelationshipRow[]> {
  const relationships = await prisma.tutorProfessionalRelationship.findMany({
    where: {
      ...(filter.relationshipLevel
        ? { relationshipLevel: { equals: filter.relationshipLevel as never } }
        : {}),
    },
    select: {
      id:                true,
      tutorId:           true,
      professionalId:    true,
      completedServices: true,
      reviewsGiven:      true,
      relationshipScore: true,
      relationshipLevel: true,
      firstServiceAt:    true,
      lastServiceAt:     true,
      tutor:        { select: { displayName: true } },
      professional: { select: { displayName: true } },
    },
    orderBy: { completedServices: "desc" },
    take: 300,
  })

  if (relationships.length === 0) return []

  // `totalRequests` é derivado de ServiceRequest, não do contador materializado
  // (legado — ver comentário no schema). Um único groupBy resolve todos os
  // pares da página: nada de uma query por linha.
  //
  // O filtro por tutorId/professionalId restringe a agregação aos pares
  // efetivamente exibidos; o groupBy conta TODAS as statuses, que é a
  // definição de volume operacional do par.
  const volumePorPar = await prisma.serviceRequest.groupBy({
    by: ["tutorId", "professionalId"],
    where: {
      tutorId:        { in: [...new Set(relationships.map((r) => r.tutorId))] },
      professionalId: { in: [...new Set(relationships.map((r) => r.professionalId))] },
    },
    _count: { id: true },
  })

  const chave = (tutorId: string, professionalId: string) => `${tutorId}:${professionalId}`
  const totalPorPar = new Map(
    volumePorPar.map((v) => [chave(v.tutorId, v.professionalId), v._count.id])
  )

  return relationships.map((r) => ({
    id:                r.id,
    tutorName:         r.tutor.displayName,
    professionalName:  r.professional.displayName,
    completedServices: r.completedServices,
    totalRequests:     totalPorPar.get(chave(r.tutorId, r.professionalId)) ?? 0,
    reviewsGiven:      r.reviewsGiven,
    relationshipScore: r.relationshipScore,
    relationshipLevel: r.relationshipLevel,
    firstServiceAt:    r.firstServiceAt,
    lastServiceAt:     r.lastServiceAt,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL FLAGS — Etapa 5.5
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ERRO NÃO É VAZIO — POR QUE O `catch { return [] }` SAIU DAQUI
 *
 * Esta função (e `getAdminDisputes`) engolia a exceção e devolvia lista vazia.
 * O efeito no backoffice era o pior possível para uma tela de investigação:
 * banco fora do ar produzia exatamente a mesma imagem que "não há flags" —
 * tabela vazia, sem aviso — e quem estava investigando concluía que não havia
 * nada a investigar.
 *
 * O silenciamento provavelmente existia porque não havia fronteira de erro no
 * admin: sem ela, deixar a exceção subir daria tela em branco. Agora existe
 * (`app/(admin)/admin/error.tsx`), com mensagem que separa "falhou ao carregar"
 * de "não há registros" e botão de tentar de novo. Deixar a exceção subir passou
 * a ser a opção correta.
 */
export async function getAdminFlags(
  filter: AdminFlagsFilter = {}
): Promise<AdminFlagRow[]> {
  {
    const flags = await prisma.operationalFlag.findMany({
      where: {
        ...(filter.status     && { status:     filter.status     as never }),
        ...(filter.severity   && { severity:   filter.severity   as never }),
        ...(filter.targetType && { targetType: filter.targetType as never }),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return flags.map((f) => ({
      id:         f.id,
      targetType: f.targetType,
      targetId:   f.targetId,
      reason:     f.reason,
      severity:   f.severity,
      source:     f.source,
      status:     f.status,
      createdAt:  f.createdAt,
      resolvedAt: f.resolvedAt,
    }))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTES — Etapa 5.5
// ─────────────────────────────────────────────────────────────────────────────

/** Erro não é vazio — ver o bloco em `getAdminFlags`. */
export async function getAdminDisputes(
  filter: AdminDisputesFilter = {}
): Promise<AdminDisputeRow[]> {
  {
    const disputes = await prisma.dispute.findMany({
      where: {
        ...(filter.status && { status: filter.status as never }),
      },
      include: {
        request: {
          include: {
            tutor:        { select: { displayName: true } },
            professional: { select: { displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return disputes.map((d) => ({
      id:               d.id,
      requestId:        d.requestId,
      tutorName:        d.request.tutor.displayName,
      professionalName: d.request.professional.displayName,
      reason:           d.reason,
      description:      d.description,
      status:           d.status,
      createdAt:        d.createdAt,
      resolvedAt:       d.resolvedAt,
    }))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN AUDIT LOG — Etapa 5.5
// ─────────────────────────────────────────────────────────────────────────────

function collectEntityIds(
  entries: { entityType: string; entityId: string }[],
  type: string
): string[] {
  const upper = type.toUpperCase()
  return [...new Set(entries.filter((e) => e.entityType.toUpperCase() === upper).map((e) => e.entityId))]
}

const PARTNER_RECOMMENDATION_ACTIONS = new Set([
  "partner.recommendation_created",
  "partner.recommendation_deactivated",
  "partner.recommendation_activated",
])

function isDisputeAuditEntry(entityType: string, action: string): boolean {
  return entityType.toUpperCase() === "DISPUTE" || action.startsWith("dispute.")
}

function extractDisputeAuditPayload(
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null
): { requestId?: string } | null {
  const data = after ?? before
  if (!data) return null

  const requestId =
    typeof data.requestId === "string" ? data.requestId : undefined

  return requestId ? { requestId } : null
}

function formatDisputeEntityLabel(
  tutorName: string,
  professionalName: string
): string {
  return `Disputa: ${tutorName} × ${professionalName}`
}

function formatShortAuditId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

function resolveDisputeEntityLabel(
  action: string,
  entityType: string,
  entityId: string,
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null,
  disputeLabels: Map<string, string>,
  disputeLabelsByRequestId: Map<string, string>
): string | null {
  if (!isDisputeAuditEntry(entityType, action)) return null

  const fromDisputeId = disputeLabels.get(entityId)
  if (fromDisputeId) return fromDisputeId

  const payload = extractDisputeAuditPayload(after, before)
  if (payload?.requestId) {
    const fromRequestId = disputeLabelsByRequestId.get(payload.requestId)
    if (fromRequestId) return fromRequestId
  }

  return `Disputa · ${formatShortAuditId(entityId)}`
}

function extractRecommendationAuditPayload(
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null
): { partnerId?: string; professionalName?: string } | null {
  const data = after ?? before
  if (!data) return null

  const partnerId =
    typeof data.partnerId === "string" ? data.partnerId : undefined
  const professionalName =
    typeof data.professionalName === "string" ? data.professionalName : undefined

  if (!partnerId && !professionalName) return null
  return { partnerId, professionalName }
}

function resolvePartnerRecommendationEntityLabel(
  action: string,
  entityId: string,
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null,
  partnerNames: Map<string, string>
): string | null {
  if (!PARTNER_RECOMMENDATION_ACTIONS.has(action)) return null

  const payload = extractRecommendationAuditPayload(after, before)
  const partnerName = payload?.partnerId
    ? partnerNames.get(payload.partnerId)
    : undefined
  const professionalName = payload?.professionalName

  if (partnerName && professionalName) {
    return `Recomendação: ${partnerName} → ${professionalName}`
  }

  return `Recomendação · ${formatShortAuditId(entityId)}`
}

function resolveTrustConnectionEntityLabel(
  entityType: string,
  entityId: string,
  trustConnectionLabels: Map<string, string>
): string | null {
  if (entityType.toUpperCase() !== "TRUSTCONNECTION") return null
  return trustConnectionLabels.get(entityId) ?? `Conexão de confiança · ${formatShortAuditId(entityId)}`
}

function resolveAvailabilityEntityLabel(
  action: string,
  entityType: string,
  entityId: string,
  proLabel: Map<string, string>
): string | null {
  if (action !== "professional.availability_updated") return null
  const profileLabel = proLabel.get(entityId)
  if (profileLabel) return `Disponibilidade · ${profileLabel.split(" — ")[0]}`
  return `Disponibilidade profissional · ${formatShortAuditId(entityId)}`
}

/**
 * ERRO NÃO É VAZIO — ver a nota completa em `getAdminFlags`.
 *
 * GATE-14: esta função e `getAdminRiskData` ainda tinham o `catch { return [] }`
 * que aquela nota diz ter sido removido — a correção anterior pegou flags e
 * disputes e deixou estas duas para trás. Pior: o catch era CEGO, nem logava.
 * Um banco fora do ar produzia "Nenhum registro" na trilha de auditoria — a
 * tela de investigação afirmando, com confiança, que não havia o que investigar.
 *
 * A exceção agora sobe para `app/(admin)/admin/error.tsx`, que separa "falhou
 * ao carregar" de "não há registros" e oferece tentar de novo.
 */
export async function getAdminAuditLogs(
  filter: AdminAuditFilter = {}
): Promise<AdminAuditRow[]> {
  {
    const [adminLogs, userLogs] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: {
          ...(filter.action     && { action:     { contains: filter.action,     mode: "insensitive" } }),
          ...(filter.entityType && { entityType: { equals:   filter.entityType, mode: "insensitive" } }),
        },
        include: {
          admin: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.auditLog.findMany({
        where: {
          ...(filter.action     && { action: { contains: filter.action, mode: "insensitive" } }),
          ...(filter.entityType && { entity: { equals: filter.entityType, mode: "insensitive" } }),
        },
        include: {
          user: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ])

    const allEntries = [
      ...adminLogs.map((l) => ({ entityType: l.entityType, entityId: l.entityId })),
      ...userLogs.map((l) => ({ entityType: l.entity, entityId: l.entityId })),
    ]

    const proIds = [
      ...new Set([
        ...collectEntityIds(allEntries, "PROFESSIONAL"),
        ...collectEntityIds(allEntries, "PROFESSIONALPROFILE"),
      ]),
    ]
    const partnerIds = [
      ...new Set([
        ...collectEntityIds(allEntries, "PARTNER"),
        ...userLogs.flatMap((l) => {
          if (!PARTNER_RECOMMENDATION_ACTIONS.has(l.action)) return []
          const payload = extractRecommendationAuditPayload(
            l.after as Record<string, unknown> | null,
            l.before as Record<string, unknown> | null
          )
          return payload?.partnerId ? [payload.partnerId] : []
        }),
      ]),
    ]
    const tutorProfileIds = collectEntityIds(allEntries, "TUTORPROFILE")
    const petIds = collectEntityIds(allEntries, "PET")
    const disputeIds = [
      ...new Set([
        ...collectEntityIds(allEntries, "DISPUTE"),
        ...adminLogs
          .filter((l) => isDisputeAuditEntry(l.entityType, l.action))
          .map((l) => l.entityId),
        ...userLogs
          .filter((l) => isDisputeAuditEntry(l.entity, l.action))
          .map((l) => l.entityId),
      ]),
    ]
    const disputeRequestIds = [
      ...new Set([
        ...adminLogs
          .filter((l) => isDisputeAuditEntry(l.entityType, l.action))
          .flatMap((l) => {
            const payload = extractDisputeAuditPayload(
              (l.metadata as Record<string, unknown> | null) ?? null,
              null
            )
            return payload?.requestId ? [payload.requestId] : []
          }),
        ...userLogs
          .filter((l) => isDisputeAuditEntry(l.entity, l.action))
          .flatMap((l) => {
            const payload = extractDisputeAuditPayload(
              l.after as Record<string, unknown> | null,
              l.before as Record<string, unknown> | null
            )
            return payload?.requestId ? [payload.requestId] : []
          }),
      ]),
    ]

    const trustConnectionIds = collectEntityIds(allEntries, "TRUSTCONNECTION")

    const [professionals, partners, tutorProfiles, pets, disputes, trustConnections] = await Promise.all([
      proIds.length
        ? prisma.professionalProfile.findMany({
            where: { id: { in: proIds } },
            select: {
              id: true,
              displayName: true,
              user: { select: { email: true } },
            },
          })
        : Promise.resolve([]),
      partnerIds.length
        ? prisma.partner.findMany({
            where: { id: { in: partnerIds } },
            select: { id: true, businessName: true, city: true },
          })
        : Promise.resolve([]),
      tutorProfileIds.length
        ? prisma.tutorProfile.findMany({
            where: { id: { in: tutorProfileIds } },
            select: {
              id: true,
              displayName: true,
              user: { select: { email: true } },
            },
          })
        : Promise.resolve([]),
      petIds.length
        ? prisma.pet.findMany({
            where: { id: { in: petIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      disputeIds.length || disputeRequestIds.length
        ? prisma.dispute.findMany({
            where: {
              OR: [
                ...(disputeIds.length ? [{ id: { in: disputeIds } }] : []),
                ...(disputeRequestIds.length
                  ? [{ requestId: { in: disputeRequestIds } }]
                  : []),
              ],
            },
            select: {
              id: true,
              requestId: true,
              request: {
                select: {
                  tutor: { select: { displayName: true } },
                  professional: { select: { displayName: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      trustConnectionIds.length
        ? prisma.trustConnection.findMany({
            where: { id: { in: trustConnectionIds } },
            select: {
              id: true,
              sourcePartner: { select: { businessName: true } },
              targetProfile: { select: { displayName: true } },
            },
          })
        : Promise.resolve([]),
    ])

    const proLabel = new Map(
      professionals.map((p) => [
        p.id,
        `${p.displayName} — ${p.user.email ?? "sem email"}`,
      ])
    )
    const partnerLabel = new Map(
      partners.map((p) => [p.id, `${p.businessName} — parceiro (${p.city})`])
    )
    const partnerBusinessName = new Map(
      partners.map((p) => [p.id, p.businessName])
    )
    const tutorProfileLabel = new Map(
      tutorProfiles.map((t) => [
        t.id,
        `${t.displayName} — ${t.user.email ?? "sem email"}`,
      ])
    )
    const petLabel = new Map(pets.map((p) => [p.id, p.name]))
    const disputeLabel = new Map<string, string>()
    const disputeLabelByRequestId = new Map<string, string>()

    for (const dispute of disputes) {
      const label = formatDisputeEntityLabel(
        dispute.request.tutor.displayName,
        dispute.request.professional.displayName
      )
      disputeLabel.set(dispute.id, label)
      disputeLabelByRequestId.set(dispute.requestId, label)
    }

    const trustConnectionLabel = new Map<string, string>()
    for (const connection of trustConnections) {
      const partnerName =
        connection.sourcePartner?.businessName ?? "Parceiro"
      const professionalName = connection.targetProfile.displayName
      trustConnectionLabel.set(
        connection.id,
        `Conexão: ${partnerName} → ${professionalName}`
      )
    }

    function resolveEntityLabel(entityType: string, entityId: string): string | null {
      const type = entityType.toUpperCase()
      if (type === "PROFESSIONAL" || type === "PROFESSIONALPROFILE")
        return proLabel.get(entityId) ?? null
      if (type === "PARTNER") return partnerLabel.get(entityId) ?? null
      if (type === "TUTORPROFILE") return tutorProfileLabel.get(entityId) ?? null
      if (type === "PET") return petLabel.get(entityId) ?? null
      return null
    }

    const adminRows: AdminAuditRow[] = adminLogs.map((l) => {
      const metadata = (l.metadata as Record<string, unknown>) ?? null

      return {
        id:          l.id,
        actorEmail:  l.admin.email ?? "—",
        actorKind:   "admin",
        action:      l.action,
        entityType:  l.entityType,
        entityId:    l.entityId,
        entityLabel:
          resolveDisputeEntityLabel(
            l.action,
            l.entityType,
            l.entityId,
            metadata,
            null,
            disputeLabel,
            disputeLabelByRequestId
          ) ?? resolveEntityLabel(l.entityType, l.entityId),
        metadata,
        createdAt:   l.createdAt,
      }
    })

    const userRows: AdminAuditRow[] = userLogs.map((l) => {
      const after = l.after as Record<string, unknown> | null
      const before = l.before as Record<string, unknown> | null
      const fallbackLabel =
        typeof after?.displayName === "string"
          ? `${after.displayName} — ${l.user.email ?? "sem email"}`
          : typeof after?.name === "string"
            ? after.name
            : null

      return {
        id:          l.id,
        actorEmail:  l.user.email ?? "—",
        actorKind:   "user",
        action:      l.action,
        entityType:  l.entity,
        entityId:    l.entityId,
        entityLabel:
          resolveDisputeEntityLabel(
            l.action,
            l.entity,
            l.entityId,
            after,
            before,
            disputeLabel,
            disputeLabelByRequestId
          ) ??
          resolvePartnerRecommendationEntityLabel(
            l.action,
            l.entityId,
            after,
            before,
            partnerBusinessName
          ) ??
          resolveTrustConnectionEntityLabel(l.entity, l.entityId, trustConnectionLabel) ??
          resolveAvailabilityEntityLabel(l.action, l.entity, l.entityId, proLabel) ??
          resolveEntityLabel(l.entity, l.entityId) ??
          fallbackLabel,
        metadata:    (after ?? before) ?? null,
        createdAt:   l.createdAt,
      }
    })

    return [...adminRows, ...userRows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK SCORES — Etapa 5.5
// ─────────────────────────────────────────────────────────────────────────────

/** ERRO NÃO É VAZIO — mesma correção e mesmo motivo de `getAdminAuditLogs`. */
export async function getAdminRiskData(): Promise<AdminRiskRow[]> {
  {
    const [riskResults, professionals] = await Promise.all([
      calculateAllRiskScores(),
      prisma.professionalProfile.findMany({
        where:  { deletedAt: null },
        select: { id: true, displayName: true, city: true },
      }),
    ])

    const cityMap = new Map(professionals.map((p) => [p.id, p.city]))

    return riskResults.map((r) => ({
      id:          r.professionalId,
      displayName: r.displayName,
      city:        cityMap.get(r.professionalId) ?? "—",
      score:       r.score,
      level:       r.level,
    }))
  }
}
