/**
 * módulo: verification
 * camada: infrastructure — repository (Etapa 6.2)
 */

import { prisma } from "@/lib/prisma/client"
import { Prisma } from "@prisma/client"
import type {
  VerificationRequest,
  VerificationAdminRow,
  VerificationMetrics,
  VerificationListFilters,
  CreateVerificationRequestInput,
  VerificationEntityType,
  VerificationRequestStatus,
  VerificationLifecycleEvent,
} from "../domain/types"

const DELEGATE_UNAVAILABLE =
  "Módulo VerificationRequest indisponível no Prisma Client. Execute `npx prisma generate` e reinicie o servidor."

function getDelegate() {
  const delegate = (prisma as unknown as { verificationRequest?: typeof prisma.verificationRequest })
    .verificationRequest
  if (!delegate) throw new Error(DELEGATE_UNAVAILABLE)
  return delegate
}

function mapRow(row: {
  id: string
  entityType: string
  entityId: string
  status: string
  requestedAt: Date
  reviewedAt: Date | null
  reviewedByAdminId: string | null
  rejectionReason: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): VerificationRequest {
  return {
    ...row,
    entityType: row.entityType as VerificationEntityType,
    status: row.status as VerificationRequestStatus,
  }
}

async function resolveEntityName(
  entityType: VerificationEntityType,
  entityId: string
): Promise<string> {
  if (entityType === "PARTNER") {
    const partner = await prisma.partner.findUnique({
      where: { id: entityId },
      select: { businessName: true },
    })
    return partner?.businessName ?? entityId.slice(0, 8)
  }

  const pro = await prisma.professionalProfile.findUnique({
    where: { id: entityId },
    select: { displayName: true },
  })
  return pro?.displayName ?? entityId.slice(0, 8)
}

async function resolveAdminEmail(adminUserId: string | null): Promise<string | null> {
  if (!adminUserId) return null
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { email: true },
  })
  return user?.email ?? null
}

type EntityVerificationState = {
  isVerified: boolean
  isSuspended: boolean
}

async function getEntityVerificationStates(
  entityType: VerificationEntityType,
  entityIds: string[]
): Promise<Map<string, EntityVerificationState>> {
  const result = new Map<string, EntityVerificationState>()
  if (entityIds.length === 0) return result

  if (entityType === "PROFESSIONAL") {
    const pros = await prisma.professionalProfile.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, isVerified: true, verifiedIdentity: true },
    })
    const approvedIds = await getApprovedEntityIds("PROFESSIONAL", entityIds)
    for (const pro of pros) {
      const isVerified = pro.isVerified && pro.verifiedIdentity
      const isSuspended = approvedIds.has(pro.id) && !isVerified
      result.set(pro.id, { isVerified, isSuspended })
    }
    return result
  }

  const partners = await prisma.partner.findMany({
    where: { id: { in: entityIds } },
    select: { id: true, isVerified: true, verificationStatus: true },
  })
  for (const partner of partners) {
    const isVerified =
      partner.isVerified && partner.verificationStatus === "VERIFIED"
    const isSuspended = partner.verificationStatus === "SUSPENDED"
    result.set(partner.id, { isVerified, isSuspended })
  }
  return result
}

async function getApprovedEntityIds(
  entityType: VerificationEntityType,
  entityIds: string[]
): Promise<Set<string>> {
  try {
    const rows = await getDelegate().findMany({
      where: {
        entityType,
        entityId: { in: entityIds },
        status: "APPROVED",
      },
      select: { entityId: true },
    })
    return new Set(rows.map((r) => r.entityId))
  } catch {
    return new Set()
  }
}

async function getLatestLifecycleEvents(
  entityKeys: Array<{ entityType: string; entityId: string }>
): Promise<Map<string, VerificationLifecycleEvent>> {
  const result = new Map<string, VerificationLifecycleEvent>()
  if (entityKeys.length === 0) return result

  const entityIds = [...new Set(entityKeys.map((k) => k.entityId))]
  try {
    const logs = await prisma.adminAuditLog.findMany({
      where: {
        entityId: { in: entityIds },
        action: { in: ["verification.suspended", "verification.reactivated"] },
      },
      include: { admin: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    })

    for (const log of logs) {
      const key = `${log.entityType}:${log.entityId}`
      if (result.has(key)) continue
      const metadata = (log.metadata as Record<string, unknown> | null) ?? null
      result.set(key, {
        action: log.action as VerificationLifecycleEvent["action"],
        adminEmail: log.admin.email,
        createdAt: log.createdAt,
        reason: typeof metadata?.reason === "string" ? metadata.reason : null,
      })
    }
  } catch {
    // ignore
  }
  return result
}

export async function getVerificationMetrics(): Promise<VerificationMetrics> {
  try {
    const delegate = getDelegate()
    const [pending, approved, rejected] = await Promise.all([
      delegate.count({ where: { status: "PENDING" } }),
      delegate.count({ where: { status: "APPROVED" } }),
      delegate.count({ where: { status: "REJECTED" } }),
    ])
    return { pending, approved, rejected }
  } catch {
    return { pending: 0, approved: 0, rejected: 0 }
  }
}

export async function getVerificationRequests(
  filters?: VerificationListFilters
): Promise<VerificationAdminRow[]> {
  try {
    const delegate = getDelegate()
    const where: Record<string, unknown> = {}
    if (filters?.entityType) where.entityType = filters.entityType
    if (filters?.status) where.status = filters.status

    const rows = await delegate.findMany({
      where,
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    })

    const proIds = rows
      .filter((r) => r.entityType === "PROFESSIONAL")
      .map((r) => r.entityId)
    const partnerIds = rows
      .filter((r) => r.entityType === "PARTNER")
      .map((r) => r.entityId)

    const [proStates, partnerStates] = await Promise.all([
      getEntityVerificationStates("PROFESSIONAL", proIds),
      getEntityVerificationStates("PARTNER", partnerIds),
    ])

    const lifecycleKeys = rows
      .filter((r) => r.status === "APPROVED")
      .map((r) => ({ entityType: r.entityType, entityId: r.entityId }))
    const lifecycleEvents = await getLatestLifecycleEvents(lifecycleKeys)

    const result: VerificationAdminRow[] = []
    for (const row of rows) {
      const mapped = mapRow(row)
      const stateMap =
        mapped.entityType === "PROFESSIONAL" ? proStates : partnerStates
      const state = stateMap.get(mapped.entityId) ?? {
        isVerified: false,
        isSuspended: false,
      }
      const lifecycleKey = `${mapped.entityType}:${mapped.entityId}`

      result.push({
        ...mapped,
        entityName: await resolveEntityName(mapped.entityType, mapped.entityId),
        reviewedByAdminEmail: await resolveAdminEmail(mapped.reviewedByAdminId),
        entityIsVerified: state.isVerified,
        entityIsSuspended: state.isSuspended,
        canSuspend: mapped.status === "APPROVED" && state.isVerified,
        canReactivate: mapped.status === "APPROVED" && state.isSuspended,
        lastLifecycleEvent: lifecycleEvents.get(lifecycleKey) ?? null,
      })
    }
    return result
  } catch (err) {
    if (err instanceof Error && err.message === DELEGATE_UNAVAILABLE) throw err
    return []
  }
}

export async function getVerificationRequestById(
  id: string
): Promise<VerificationRequest | null> {
  try {
    const row = await getDelegate().findUnique({ where: { id } })
    return row ? mapRow(row) : null
  } catch (err) {
    if (err instanceof Error && err.message === DELEGATE_UNAVAILABLE) throw err
    return null
  }
}

export async function findPendingVerificationRequest(
  entityType: VerificationEntityType,
  entityId: string
): Promise<VerificationRequest | null> {
  try {
    const row = await getDelegate().findFirst({
      where: { entityType, entityId, status: "PENDING" },
      orderBy: { requestedAt: "desc" },
    })
    return row ? mapRow(row) : null
  } catch {
    return null
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  )
}

export async function dedupePendingVerificationRequests(): Promise<number> {
  try {
    const delegate = getDelegate()
    const pendingGroups = await delegate.groupBy({
      by: ["entityType", "entityId"],
      where: { status: "PENDING" },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    })

    let removed = 0
    for (const group of pendingGroups) {
      const rows = await delegate.findMany({
        where: {
          entityType: group.entityType,
          entityId:   group.entityId,
          status:     "PENDING",
        },
        orderBy: [{ requestedAt: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      })

      const [, ...duplicates] = rows
      for (const dup of duplicates) {
        await delegate.delete({ where: { id: dup.id } })
        removed++
      }
    }
    return removed
  } catch {
    return 0
  }
}

export async function closeAllPendingVerificationRequestsForEntity(
  entityType: VerificationEntityType,
  entityId: string,
  adminUserId: string | null,
  finalStatus: "APPROVED" | "REJECTED",
  rejectionReason?: string
): Promise<number> {
  const pending = await getDelegate().findMany({
    where: { entityType, entityId, status: "PENDING" },
    select: { id: true, notes: true },
  })

  for (const req of pending) {
    const autoNote =
      finalStatus === "APPROVED" && adminUserId === null
        ? "Auto-encerrada: entidade já verificada."
        : null

    await getDelegate().update({
      where: { id: req.id },
      data: {
        status: finalStatus,
        reviewedAt: new Date(),
        reviewedByAdminId: adminUserId,
        rejectionReason: finalStatus === "REJECTED" ? (rejectionReason?.trim() ?? null) : null,
        ...(autoNote
          ? {
              notes: req.notes ? `${req.notes} · ${autoNote}` : autoNote,
            }
          : {}),
      },
    })
  }

  return pending.length
}

/**
 * Profissionais/parceiros já verificados não podem manter solicitações PENDING.
 * Corrige legado (verificação manual antes da Fila) e estados inconsistentes.
 */
export async function reconcileVerifiedEntityPendingRequests(): Promise<number> {
  try {
    let closed = 0

    const verifiedPros = await prisma.professionalProfile.findMany({
      where: { isVerified: true },
      select: { id: true },
    })
    for (const pro of verifiedPros) {
      closed += await closeAllPendingVerificationRequestsForEntity(
        "PROFESSIONAL",
        pro.id,
        null,
        "APPROVED"
      )
    }

    const verifiedPartners = await prisma.partner.findMany({
      where: {
        OR: [{ isVerified: true }, { verificationStatus: "VERIFIED" }],
      },
      select: { id: true },
    })
    for (const partner of verifiedPartners) {
      closed += await closeAllPendingVerificationRequestsForEntity(
        "PARTNER",
        partner.id,
        null,
        "APPROVED"
      )
    }

    return closed
  } catch {
    return 0
  }
}

export async function createVerificationRequestRecord(
  input: CreateVerificationRequestInput
): Promise<VerificationRequest> {
  if (input.entityType === "PROFESSIONAL") {
    if (await isProfessionalVerified(input.entityId)) {
      throw new Error("Profissional já verificado — solicitação não permitida.")
    }
    if (await hasApprovedVerificationRequest("PROFESSIONAL", input.entityId)) {
      throw new Error(
        "Profissional com verificação aprovada anteriormente — use reativação no admin."
      )
    }
  } else if (input.entityType === "PARTNER") {
    const partner = await prisma.partner.findUnique({
      where: { id: input.entityId },
      select: { isVerified: true, verificationStatus: true },
    })
    if (
      partner?.isVerified ||
      partner?.verificationStatus === "VERIFIED"
    ) {
      throw new Error("Parceiro já verificado — solicitação não permitida.")
    }
    if (partner?.verificationStatus === "SUSPENDED") {
      throw new Error(
        "Parceiro com verificação suspensa — use reativação no admin."
      )
    }
    if (await hasApprovedVerificationRequest("PARTNER", input.entityId)) {
      throw new Error(
        "Parceiro com verificação aprovada anteriormente — use reativação no admin."
      )
    }
  }

  const existing = await findPendingVerificationRequest(input.entityType, input.entityId)
  if (existing) return existing

  try {
    const row = await getDelegate().create({
      data: {
        entityType: input.entityType,
        entityId:   input.entityId,
        status:     "PENDING",
        notes:      input.notes?.trim() || null,
        ...(input.requestedAt ? { requestedAt: input.requestedAt } : {}),
      },
    })
    return mapRow(row)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const retry = await findPendingVerificationRequest(input.entityType, input.entityId)
      if (retry) return retry
    }
    throw err
  }
}

export async function applyPartnerVerificationPending(partnerId: string): Promise<void> {
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      verificationStatus: "PENDING_VERIFICATION",
      verificationRequestedAt: new Date(),
    },
  })
}

export async function applyPartnerVerificationApproved(partnerId: string): Promise<void> {
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      isVerified: true,
      verificationStatus: "VERIFIED",
    },
  })
}

export async function applyPartnerVerificationRejected(partnerId: string): Promise<void> {
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      verificationStatus: "NONE",
    },
  })
}

export async function hasApprovedVerificationRequest(
  entityType: VerificationEntityType,
  entityId: string
): Promise<boolean> {
  try {
    const row = await getDelegate().findFirst({
      where: { entityType, entityId, status: "APPROVED" },
      select: { id: true },
    })
    return !!row
  } catch {
    return false
  }
}

export async function getSuspendedProfessionalEntityIds(): Promise<Set<string>> {
  try {
    const approved = await getDelegate().findMany({
      where: { entityType: "PROFESSIONAL", status: "APPROVED" },
      select: { entityId: true },
    })
    const ids = approved.map((r) => r.entityId)
    if (ids.length === 0) return new Set()

    const suspended = await prisma.professionalProfile.findMany({
      where: {
        id: { in: ids },
        NOT: {
          AND: [{ isVerified: true }, { verifiedIdentity: true }],
        },
      },
      select: { id: true },
    })
    return new Set(suspended.map((p) => p.id))
  } catch {
    return new Set()
  }
}

export async function applyProfessionalVerificationSuspended(
  professionalId: string
): Promise<void> {
  await prisma.professionalProfile.update({
    where: { id: professionalId },
    data: {
      isVerified: false,
      verifiedIdentity: false,
      // verifiedAt mantido como histórico da aprovação original
    },
  })
}

export async function applyProfessionalVerificationReactivated(
  professionalId: string
): Promise<void> {
  const existing = await prisma.professionalProfile.findUnique({
    where: { id: professionalId },
    select: { verifiedAt: true },
  })
  const now = new Date()
  await prisma.professionalProfile.update({
    where: { id: professionalId },
    data: {
      isVerified: true,
      verifiedIdentity: true,
      verifiedAt: existing?.verifiedAt ?? now,
    },
  })
}

export async function applyPartnerVerificationSuspended(partnerId: string): Promise<void> {
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      isVerified: false,
      verificationStatus: "SUSPENDED",
    },
  })
}

export async function applyPartnerVerificationReactivated(partnerId: string): Promise<void> {
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      isVerified: true,
      verificationStatus: "VERIFIED",
    },
  })
}

export async function isEntityVerificationSuspended(
  entityType: VerificationEntityType,
  entityId: string
): Promise<boolean> {
  const states = await getEntityVerificationStates(entityType, [entityId])
  return states.get(entityId)?.isSuspended ?? false
}

export async function isEntityVerificationActive(
  entityType: VerificationEntityType,
  entityId: string
): Promise<boolean> {
  const states = await getEntityVerificationStates(entityType, [entityId])
  return states.get(entityId)?.isVerified ?? false
}

export async function applyProfessionalVerificationApproved(
  professionalId: string
): Promise<void> {
  const now = new Date()
  await prisma.professionalProfile.update({
    where: { id: professionalId },
    data: {
      isVerified: true,
      verifiedIdentity: true,
      verifiedAt: now,
    },
  })
}

export async function approveVerificationRequestRecord(
  id: string,
  adminUserId: string
): Promise<VerificationRequest> {
  const row = await getDelegate().update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedByAdminId: adminUserId,
      rejectionReason: null,
    },
  })
  return mapRow(row)
}

export async function rejectVerificationRequestRecord(
  id: string,
  adminUserId: string,
  rejectionReason: string
): Promise<VerificationRequest> {
  const row = await getDelegate().update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedByAdminId: adminUserId,
      rejectionReason: rejectionReason.trim(),
    },
  })
  return mapRow(row)
}

export async function getPendingProfessionalVerificationEntityIds(): Promise<Set<string>> {
  try {
    const verifiedIds = await prisma.professionalProfile.findMany({
      where: { isVerified: true },
      select: { id: true },
    })
    const exclude = new Set(verifiedIds.map((p) => p.id))

    const rows = await getDelegate().findMany({
      where: { entityType: "PROFESSIONAL", status: "PENDING" },
      select: { entityId: true },
    })
    return new Set(rows.map((r) => r.entityId).filter((id) => !exclude.has(id)))
  } catch {
    return new Set()
  }
}

export async function isProfessionalVerified(professionalId: string): Promise<boolean> {
  const pro = await prisma.professionalProfile.findUnique({
    where: { id: professionalId },
    select: { isVerified: true },
  })
  return pro?.isVerified ?? false
}

export async function getPartnerSlug(partnerId: string): Promise<string | null> {
  const p = await prisma.partner.findUnique({ where: { id: partnerId }, select: { slug: true } })
  return p?.slug ?? null
}

/**
 * Parceiros marcados PENDING_VERIFICATION antes da Etapa 6.2 ou quando
 * requestVerificationAction falhou (Prisma stale) podem não ter linha na fila.
 */
export async function backfillPendingPartnerVerificationRequests(): Promise<number> {
  try {
    const partners = await prisma.partner.findMany({
      where: { verificationStatus: "PENDING_VERIFICATION" },
      select: {
        id: true,
        verificationRequestedAt: true,
        yearsInBusiness: true,
        hasCnpj: true,
      },
    })

    let created = 0
    for (const partner of partners) {
      const before = await findPendingVerificationRequest("PARTNER", partner.id)
      if (before) continue

      const notes = [
        partner.yearsInBusiness != null ? `Anos: ${partner.yearsInBusiness}` : null,
        partner.hasCnpj ? "Possui CNPJ" : null,
        "Backfill — solicitação registrada no Partner antes da fila 6.2",
      ]
        .filter(Boolean)
        .join(" · ")

      await createVerificationRequestRecord({
        entityType:  "PARTNER",
        entityId:    partner.id,
        notes:       notes || undefined,
        requestedAt: partner.verificationRequestedAt ?? undefined,
      })
      created++
    }
    return created
  } catch {
    return 0
  }
}

export async function ensurePartnerVerificationRequest(
  partnerId: string,
  notes?: string
): Promise<VerificationRequest | null> {
  try {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        verificationStatus: true,
        verificationRequestedAt: true,
        yearsInBusiness: true,
        hasCnpj: true,
      },
    })
    if (!partner || partner.verificationStatus !== "PENDING_VERIFICATION") {
      return null
    }

    return createVerificationRequestRecord({
      entityType: "PARTNER",
      entityId:   partnerId,
      notes:
        notes ??
        ([
          partner.yearsInBusiness != null ? `Anos: ${partner.yearsInBusiness}` : null,
          partner.hasCnpj ? "Possui CNPJ" : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined),
    })
  } catch {
    return null
  }
}
