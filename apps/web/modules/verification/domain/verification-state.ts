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
  return profile.isVerified && profile.verifiedIdentity
}

export function isPartnerVerificationActive(partner: {
  isVerified: boolean
  verificationStatus: string
}): boolean {
  return partner.isVerified && partner.verificationStatus === "VERIFIED"
}
