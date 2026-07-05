/**
 * Estado operacional do selo de verificação (Etapa 6.2 lifecycle).
 *
 * VerificationRequest APPROVED é histórico — o selo visual depende
 * exclusivamente dos flags atuais da entidade.
 */

export function isProfessionalVerificationActive(profile: {
  isVerified: boolean
  verifiedIdentity: boolean
}): boolean {
  // `isVerified` é o selo operacional "Verificado" (ver comentário em
  // schema.prisma: "verifiedProfile = isVerified, mantido para
  // retrocompatibilidade"). `verifiedIdentity` é um selo interno distinto
  // (documento de identidade validado) que hoje só é consumido como peso
  // separado no Trust Engine (calculate-trust-score.ts) — não é
  // pré-requisito do selo público, então não gate-keeps aqui.
  return profile.isVerified
}

export function isPartnerVerificationActive(partner: {
  isVerified: boolean
  verificationStatus: string
}): boolean {
  return partner.isVerified && partner.verificationStatus === "VERIFIED"
}
