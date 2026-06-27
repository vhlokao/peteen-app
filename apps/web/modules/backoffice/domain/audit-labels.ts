/**
 * Módulo: backoffice
 * Camada: domain — labels humanos para auditoria (polish 7.8)
 */

import { DISPUTE_STATUS_LABELS, type DisputeStatus } from "@/modules/disputes/domain/types"

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "dispute.created": "Disputa aberta",
  "dispute.status_updated": "Status da disputa atualizado",
  "dispute.update": "Disputa atualizada",
  "partner.recommendation_created": "Recomendação criada por parceiro",
  "partner.recommendation_deactivated": "Recomendação desativada",
  "partner.recommendation_activated": "Recomendação reativada",
  "professional.availability_updated": "Disponibilidade profissional atualizada",
  "flag.create": "Flag criada",
  "flag.resolve": "Flag resolvida",
  "review.hide": "Avaliação ocultada",
  "review.restore": "Avaliação restaurada",
  "trust.recalculate": "Confiança recalculada",
  "verification.approved": "Verificação aprovada",
  "verification.rejected": "Verificação rejeitada",
  "verification.suspended": "Verificação suspensa",
  "verification.reactivated": "Verificação reativada",
  "tutor.profile_updated": "Perfil de tutor atualizado",
  "professional.profile_updated": "Perfil profissional atualizado",
  "pet.created": "Pet cadastrado",
  "pet.updated": "Pet atualizado",
  "pet.archived": "Pet arquivado",
  "professional.service_created": "Serviço criado",
  "professional.service_updated": "Serviço atualizado",
  "professional.service_activated": "Serviço ativado",
  "professional.service_deactivated": "Serviço desativado",
  "partner.profile_updated": "Perfil de parceiro atualizado",
}

export const AUDIT_ENTITY_TYPE_LABELS: Record<string, string> = {
  OperationalFlag: "Flag operacional",
  Dispute: "Disputa",
  Review: "Avaliação",
  PROFESSIONAL: "Profissional",
  ProfessionalProfile: "Perfil profissional",
  PARTNER: "Parceiro",
  Partner: "Parceiro",
  TutorProfile: "Perfil de tutor",
  Pet: "Pet",
  Service: "Serviço",
  ServiceRequest: "Solicitação",
  TrustConnection: "Conexão de confiança",
  ProfessionalAvailability: "Disponibilidade profissional",
}

export const AUDIT_ACTION_COLORS: Record<string, string> = {
  "flag.create": "bg-orange-100 text-orange-700",
  "flag.resolve": "bg-green-100 text-green-700",
  "dispute.update": "bg-blue-100 text-blue-700",
  "dispute.created": "bg-amber-100 text-amber-700",
  "dispute.status_updated": "bg-blue-100 text-blue-700",
  "review.hide": "bg-red-100 text-red-700",
  "review.restore": "bg-emerald-100 text-emerald-700",
  "trust.recalculate": "bg-purple-100 text-purple-700",
  "verification.approved": "bg-emerald-100 text-emerald-700",
  "verification.rejected": "bg-red-100 text-red-700",
  "verification.suspended": "bg-amber-100 text-amber-700",
  "verification.reactivated": "bg-sky-100 text-sky-700",
  "tutor.profile_updated": "bg-teal-100 text-teal-700",
  "professional.profile_updated": "bg-indigo-100 text-indigo-700",
  "pet.created": "bg-emerald-100 text-emerald-700",
  "pet.updated": "bg-sky-100 text-sky-700",
  "pet.archived": "bg-neutral-200 text-neutral-700",
  "professional.service_created": "bg-emerald-100 text-emerald-700",
  "professional.service_updated": "bg-sky-100 text-sky-700",
  "professional.service_activated": "bg-green-100 text-green-700",
  "professional.service_deactivated": "bg-amber-100 text-amber-700",
  "professional.availability_updated": "bg-indigo-100 text-indigo-700",
  "partner.recommendation_created": "bg-emerald-100 text-emerald-700",
  "partner.recommendation_deactivated": "bg-amber-100 text-amber-700",
  "partner.recommendation_activated": "bg-green-100 text-green-700",
  "partner.profile_updated": "bg-violet-100 text-violet-700",
}

export function formatAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replaceAll("_", " ").replaceAll(".", " · ")
}

export function formatAuditEntityTypeLabel(entityType: string): string {
  return AUDIT_ENTITY_TYPE_LABELS[entityType] ?? entityType
}

export function formatShortEntityId(id: string, length = 8): string {
  if (id.length <= length) return id
  return id.slice(0, length)
}

function readString(data: Record<string, unknown> | null, key: string): string | undefined {
  const value = data?.[key]
  return typeof value === "string" ? value : undefined
}

function readNumber(data: Record<string, unknown> | null, key: string): number | undefined {
  const value = data?.[key]
  return typeof value === "number" ? value : undefined
}

/** Resumo legível de metadata — sem inventar dados ausentes */
export function formatAuditMetadataSummary(
  action: string,
  metadata: Record<string, unknown> | null
): string | null {
  if (!metadata) return null

  switch (action) {
    case "dispute.created":
    case "dispute.status_updated":
    case "dispute.update": {
      const reason = readString(metadata, "reason")
      const rawStatus = readString(metadata, "status")
      const status =
        rawStatus && rawStatus in DISPUTE_STATUS_LABELS
          ? DISPUTE_STATUS_LABELS[rawStatus as DisputeStatus]
          : rawStatus
      const requestId = readString(metadata, "requestId")
      const parts = [
        reason ? `Motivo: ${reason}` : null,
        status ? `Status: ${status}` : null,
        requestId ? `Solicitação #${formatShortEntityId(requestId)}` : null,
      ].filter(Boolean)
      return parts.length > 0 ? parts.join(" · ") : null
    }
    case "partner.recommendation_created":
    case "partner.recommendation_deactivated":
    case "partner.recommendation_activated": {
      const professionalName = readString(metadata, "professionalName")
      const isActive = metadata.isActive
      const parts = [
        professionalName ? `Profissional: ${professionalName}` : null,
        typeof isActive === "boolean"
          ? isActive
            ? "Ativa"
            : "Inativa"
          : null,
      ].filter(Boolean)
      return parts.length > 0 ? parts.join(" · ") : null
    }
    case "professional.availability_updated": {
      const activeDays = readNumber(metadata, "activeDays")
      return activeDays !== undefined
        ? `${activeDays} dia${activeDays !== 1 ? "s" : ""} ativo${activeDays !== 1 ? "s" : ""}`
        : null
    }
    default:
      return null
  }
}

export function formatAuditEntityDisplay(
  entityType: string,
  entityId: string,
  entityLabel: string | null
): { primary: string; secondary: string | null } {
  const typeLabel = formatAuditEntityTypeLabel(entityType)
  const shortId = formatShortEntityId(entityId)

  if (entityLabel) {
    return {
      primary: entityLabel,
      secondary: `${typeLabel} · ${shortId}`,
    }
  }

  return {
    primary: `${typeLabel} · ${shortId}`,
    secondary: null,
  }
}
