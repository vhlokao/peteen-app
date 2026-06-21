/**

 * módulo: partners

 * camada: domain — tipos

 *

 * Entidade Partner (estabelecimento/instituição da rede Peteen).

 * Distinta de PartnerProfile (persona de usuário).

 * Puro — sem Prisma, sem IO.

 */



export type PartnerCategory =

  | "PET_SHOP"

  | "VETERINARY_CLINIC"

  | "PET_HOTEL"

  | "DAYCARE"

  | "TRAINING_CENTER"

  | "NGO"

  | "OTHER"



export type PartnerOnboardingStatus =

  | "NOT_STARTED"

  | "IN_PROGRESS"

  | "COMPLETED"



export type PartnerVerificationStatus =

  | "NONE"

  | "PENDING_VERIFICATION"

  | "VERIFIED"



export type Partner = {

  id: string

  businessName: string

  slug: string

  category: PartnerCategory

  city: string

  state: string

  description: string | null

  phone: string | null

  website: string | null

  instagram: string | null

  logoUrl: string | null

  isVerified: boolean

  isActive: boolean

  onboardingStatus: PartnerOnboardingStatus

  onboardingCompletedAt: Date | null

  verificationStatus: PartnerVerificationStatus

  yearsInBusiness: number | null

  hasCnpj: boolean

  verificationRequestedAt: Date | null

  createdAt: Date

  updatedAt: Date

}



export type PartnerAdminRow = Partner & {

  recommendationCount: number

  activationScore: number

}



export type CreatePartnerInput = {

  businessName: string

  slug?: string

  category: PartnerCategory

  city: string

  state: string

  description?: string

  phone?: string

  website?: string

  instagram?: string

  logoUrl?: string

  isVerified?: boolean

}



export type UpdatePartnerInput = Partial<CreatePartnerInput>



export type PartnerOnboardingBusinessInput = {

  category: PartnerCategory

  businessName: string

  city: string

  state: string

  phone: string

  instagram?: string

  website?: string

  description?: string

  logoUrl?: string

}



export type PartnerOnboardingTrustInput = {

  partnerId: string

  yearsInBusiness?: number

  hasCnpj: boolean

  requestVerification: boolean

}



export type PartnerOnboardingCompleteResult = {

  partner: Partner

  recommendationCount: number

  activationScore: number

  connectionsCreated: number

}



export type PartnerOperationalMetrics = {

  recommendedProfessionals: number

  activeConnections: number

  activationScore: number

}



/** Endosso de parceiro enriquecido (Trust Graph + Partner entity) */

export type PartnerEndorsement = {

  connectionId: string

  partnerId: string | null

  name: string

  slug: string | null

  category: PartnerCategory | null

  logoUrl: string | null

  isVerified: boolean

}



/** Profissional recomendado exibido no perfil público do parceiro */

export type PartnerRecommendedProfessional = {

  professionalId: string

  displayName: string

  city: string

  trustScore: number

  avatarUrl: string | null

}



/** Perfil público completo do parceiro */

export type PartnerPublicProfile = Partner & {

  recommendedProfessionals: PartnerRecommendedProfessional[]

  operationalMetrics: PartnerOperationalMetrics

}



export type PartnerDashboardMetrics = {

  activePartners: number

  verifiedPartners: number

  professionalsRecommendedByPartners: number

  onboardingInProgress: number

  onboardingCompleted: number

}



export type ProfessionalOnboardingOption = {

  id: string

  displayName: string

  city: string

  trustScore: number

  serviceTypes: string[]

}


