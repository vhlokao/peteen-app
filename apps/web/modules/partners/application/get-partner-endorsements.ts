/**
 * módulo: partners
 * camada: application — consultas enriquecidas (Trust Graph)
 */

import { prisma } from "@/lib/prisma/client"
import { isPartnerVerificationActive } from "@/modules/verification/domain/verification-state"
import { PARTNER_TRUST_ELIGIBLE_WHERE } from "../domain/trust-eligibility"
import type { PartnerEndorsement, PartnerCategory } from "../domain/types"

/** Busca endossos de parceiros para um profissional, enriquecidos com dados da entidade Partner */
export async function getPartnerEndorsementsForProfessional(
  professionalId: string
): Promise<PartnerEndorsement[]> {
  try {
    const rows = await prisma.trustConnection.findMany({
      where: {
        targetId: professionalId,
        connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
        isActive: true,
        // SA-001: um parceiro não verificado/inativo não pode aparecer como
        // "Recomendado por" — mesmo guard aplicado em
        // trust-graph/infrastructure/repository.ts, para a mesma família de
        // conexão, aqui na consulta separada que alimenta o perfil público.
        sourcePartner: PARTNER_TRUST_ELIGIBLE_WHERE,
      },
      include: {
        sourcePartner: true,
      },
      orderBy: { weight: "desc" },
    })

    return rows.map((row) => {
      const partner = row.sourcePartner
      return {
        connectionId: row.id,
        partnerId:    partner?.id ?? row.sourcePartnerId,
        name:         partner?.businessName ?? row.sourceName,
        slug:         partner?.slug ?? null,
        category:     (partner?.category as PartnerCategory | undefined) ?? null,
        logoUrl:      partner?.logoUrl ?? null,
        isVerified: partner
          ? isPartnerVerificationActive({
              isVerified: partner.isVerified,
              verificationStatus: partner.verificationStatus,
            })
          : false,
      }
    })
  } catch {
    return []
  }
}

/** Batch — endossos de parceiros para N profissionais */
export async function getPartnerEndorsementsBatch(
  professionalIds: string[]
): Promise<Map<string, PartnerEndorsement[]>> {
  const result = new Map<string, PartnerEndorsement[]>()
  if (professionalIds.length === 0) return result

  try {
    const rows = await prisma.trustConnection.findMany({
      where: {
        targetId: { in: professionalIds },
        connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
        isActive: true,
        // SA-001 — ver comentário gêmeo em getPartnerEndorsementsForProfessional.
        sourcePartner: PARTNER_TRUST_ELIGIBLE_WHERE,
      },
      include: { sourcePartner: true },
      orderBy: { weight: "desc" },
    })

    for (const row of rows) {
      const list = result.get(row.targetId) ?? []
      const partner = row.sourcePartner
      list.push({
        connectionId: row.id,
        partnerId:    partner?.id ?? row.sourcePartnerId,
        name:         partner?.businessName ?? row.sourceName,
        slug:         partner?.slug ?? null,
        category:     (partner?.category as PartnerCategory | undefined) ?? null,
        logoUrl:      partner?.logoUrl ?? null,
        isVerified: partner
          ? isPartnerVerificationActive({
              isVerified: partner.isVerified,
              verificationStatus: partner.verificationStatus,
            })
          : false,
      })
      result.set(row.targetId, list)
    }
  } catch {
    // fallback gracioso
  }

  return result
}
