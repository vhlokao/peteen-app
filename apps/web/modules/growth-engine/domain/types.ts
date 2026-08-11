/**
 * módulo: growth-engine
 * camada: domain — tipos puros
 */

export type HealthClassification =
  | "INICIAR"
  | "CRESCENDO"
  | "FORTE"
  | "DOMINANTE"

export type TerritoryMetrics = {
  supplyScore:      number  // 0–20 profissionais ativos
  demandScore:      number  // 0–20 solicitações
  trustScore:       number  // 0–20 trust médio
  recurrenceScore:  number  // 0–20 recorrência
  partnerDensity:   number  // 0–20 parceiros
}

export type RegionGrowthRow = {
  regionId:           string
  regionName:         string
  city:               string
  state:              string
  professionalCount:  number
  tutorCount:         number
  requestCount:       number
  recurrenceAvg:      number
  trustAvg:           number
  partnerCount:       number
  metrics:            TerritoryMetrics
  healthScore:        number
  classification:     HealthClassification
}

/**
 * PRESENÇA REAL por cidade — derivada dos campos normalizados dos perfis
 * (`TutorProfile.city` / `ProfessionalProfile.city`), que são a fonte de
 * verdade territorial operacional da V0.
 *
 * Distinta de `RegionGrowthRow`, que conta por `regionId`/`neighborhoodId`
 * (camada ESTRATÉGICA). Essas FKs hoje estão 100% vazias, então a tabela de
 * regiões reportava 0 profissionais e 0 tutores para Carapicuíba enquanto
 * existiam 5 e 7 de verdade — e São Paulo, sem Region cadastrada, não
 * aparecia de forma alguma.
 *
 * Presença ≠ estratégia: uma cidade com usuários reais precisa aparecer com
 * seus números mesmo sem nenhuma associação estratégica.
 */
export type CityPresenceRow = {
  city:              string
  state:             string
  professionalCount: number
  tutorCount:        number
  /** Solicitações cujo profissional está nesta cidade. */
  requestCount:      number
  /** true quando existe Region cadastrada para esta cidade (camada estratégica). */
  hasStrategicRegion: boolean
}

export type NeighborhoodHeatmapRow = {
  neighborhoodId:   string
  neighborhoodName: string
  city:             string
  state:            string
  healthScore:      number
  starRating:       number  // 1–5
}

export type GrowthOverviewMetrics = {
  citiesMonitored:        number
  neighborhoodsMonitored: number
  regionsMonitored:       number
}

export type LocalDiscoveryContext = {
  trustedNearbyCount:   number
  city:                 string | null
  neighborhood:         string | null
  region:               string | null
  hasHighRecurrence:    boolean
  communityRecommended: boolean
  messages:             string[]
}

export type TerritorialPosition = {
  neighborhood:       string | null
  region:             string | null
  city:               string
  state:              string
  rankInNeighborhood: number | null
  rankInCity:         number | null
  totalInNeighborhood: number
  totalInCity:        number
}

export type CreateRegionInput = {
  city:  string
  state: string
  name:  string
  slug?: string
}

export type CreateNeighborhoodInput = {
  city:      string
  state:     string
  name:      string
  slug?:     string
  regionId?: string
}

export type UpdateRegionInput = Partial<CreateRegionInput>
export type UpdateNeighborhoodInput = Partial<CreateNeighborhoodInput>
