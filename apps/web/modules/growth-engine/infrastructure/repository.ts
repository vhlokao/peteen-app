/**
 * módulo: growth-engine
 * camada: infrastructure — agregações territoriais via Prisma
 */

import { prisma } from "@/lib/prisma/client"
import {
  compareLocationText,
  normalizeLocationInput,
  normalizeNeighborhoodName,
} from "@/modules/location"
import {
  computeHealthScore,
  computeTerritoryMetrics,
  classifyHealthScore,
  healthToStars,
} from "../domain/scoring"
import type {
  GrowthOverviewMetrics,
  CityPresenceRow,
  RegionGrowthRow,
  NeighborhoodHeatmapRow,
  LocalDiscoveryContext,
  TerritorialPosition,
  CreateRegionInput,
  CreateNeighborhoodInput,
  UpdateRegionInput,
  UpdateNeighborhoodInput,
} from "../domain/types"
import { RECURRENCE_TRUSTED_THRESHOLD } from "../domain/constants"
import {
  exigirDelegate,
  GROWTH_DELEGATE_UNAVAILABLE,
} from "../domain/delegate-availability"
import { slugifyTerritory } from "../domain/scoring"

// FIX-002: `hasGrowthDelegates()` foi removida. Ela existia só para converter
// ausência de delegate em `0/[]` — que é exatamente o que este fix proíbe. Sem
// nenhum chamador, sobraria como convite a repetir o padrão.

function getRegionDelegate() {
  return (prisma as unknown as { region?: typeof prisma.region }).region ?? null
}

function getNeighborhoodDelegate() {
  return (prisma as unknown as { neighborhood?: typeof prisma.neighborhood }).neighborhood ?? null
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AUSÊNCIA DE DELEGATE NÃO É ZERO — GATE-15-...-FIX-002
 *
 * As ESCRITAS deste módulo (createRegion, updateRegion, createNeighborhood,
 * updateNeighborhood) já lançavam `GROWTH_DELEGATE_UNAVAILABLE` quando o Prisma
 * Client não expõe os modelos territoriais. As LEITURAS devolviam `0` e `[]`.
 *
 * Essa assimetria era o próprio diagnóstico: alguém já tinha decidido que
 * lançar era o certo, e aplicou só de um lado. Do outro, `/admin/growth`
 * pintava "Regiões cadastradas: 0", "Bairros cadastrados: 0" e "Nenhuma região
 * cadastrada" — com a mesma cara de fato de negócio que os catches de banco
 * removidos no GATE-15-001 produziam.
 *
 * A origem é diferente (client gerado sem os modelos, não banco fora do ar),
 * mas para quem lê a tela a mentira é idêntica: uma falha técnica virou
 * afirmação sobre o território.
 *
 * Agora as leituras do BACKOFFICE exigem o delegate e lançam. O erro sobe para
 * `app/(admin)/admin/error.tsx` — o MESMO caminho da falha de banco, sem estado
 * paralelo, e com a mensagem que já diz o que fazer (`prisma generate`).
 *
 * O que continua devolvendo vazio, e é legítimo: delegate PRESENTE e nenhuma
 * linha cadastrada. Esse zero é um fato, e os testes separam os dois casos.
 */
function exigirRegionDelegate() {
  return exigirDelegate(getRegionDelegate(), "Region")
}

function exigirNeighborhoodDelegate() {
  return exigirDelegate(getNeighborhoodDelegate(), "Neighborhood")
}

// ── Overview ──────────────────────────────────────────────────────────────────

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ERRO NÃO É ZERO — GATE-15, mesmo precedente do Gate 14
 *
 * Estas quatro leituras tinham `catch { return 0 / [] }`, cegos e sem log. Numa
 * tela de INTELIGÊNCIA TERRITORIAL isso é a pior falha possível: um banco fora
 * do ar não derrubava a página, pintava "Cidades monitoradas: 0" — e quem
 * decide onde investir aquisição lê zero como fato de mercado, não como falha.
 * Ninguém desconfia de um zero.
 *
 * A exceção agora sobe para `app/(admin)/admin/error.tsx`, que separa "falhou
 * ao carregar" de "não há dados" e oferece tentar de novo.
 *
 * FIX-002 — o GATE-15-001 defendeu aqui um segundo guard, dizendo que
 * `hasGrowthDelegates()` era legítimo porque "a UI já comunica isso em
 * separado". Ela não comunicava: delegate ausente devolvia `0/0/0` e a página
 * desenhava esses zeros como território. A afirmação não tinha sido verificada,
 * e virou teste — congelando a suposição como contrato. Ver
 * `exigirRegionDelegate`.
 */
export async function getGrowthOverviewMetrics(): Promise<GrowthOverviewMetrics> {
  {
    const regionDelegate = exigirRegionDelegate()
    const neighborhoodDelegate = exigirNeighborhoodDelegate()

    const [regions, neighborhoods, cities] = await Promise.all([
      regionDelegate.count(),
      neighborhoodDelegate.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT LOWER(TRIM(city))) AS count
        FROM (
          SELECT city FROM professional_profiles WHERE "deletedAt" IS NULL
          UNION
          SELECT city FROM tutor_profiles WHERE "deletedAt" IS NULL
          UNION
          SELECT city FROM partners WHERE "isActive" = TRUE
        ) AS c
      `,
    ])
    return {
      citiesMonitored:        Number(cities[0]?.count ?? 0),
      neighborhoodsMonitored: neighborhoods,
      regionsMonitored:       regions,
    }
  }
}

// ── Regiões ───────────────────────────────────────────────────────────────────

/**
 * PRESENÇA REAL por cidade — derivada dos campos normalizados dos perfis.
 *
 * Contrato V0 de Location: `TutorProfile.city/state` e
 * `ProfessionalProfile.city/state` são a fonte de verdade territorial
 * OPERACIONAL. `regionId`/`neighborhoodId` permanecem no schema mas não
 * alimentam presença enquanto não houver reconciliação formal — hoje estão
 * 100% vazios, e contar por eles reportava zero para cidades com usuários
 * reais (Carapicuíba aparecia 0/0 tendo 5 profissionais e 7 tutores; São
 * Paulo não aparecia).
 *
 * Agrupa por `(city, state)` já normalizados na escrita, então variações de
 * caixa/acento não produzem linhas duplicadas. `deletedAt` respeitado nos dois
 * perfis, como no restante do módulo.
 */
export async function getCityPresenceRows(): Promise<CityPresenceRow[]> {
  const [profissionais, tutores, regioes] = await Promise.all([
    prisma.professionalProfile.groupBy({
      by: ["city", "state"],
      where: { deletedAt: null },
      _count: true,
    }),
    prisma.tutorProfile.groupBy({
      by: ["city", "state"],
      where: { deletedAt: null },
      _count: true,
    }),
    // FIX-002: era `getRegionDelegate()?.findMany(...) ?? []`. Sem o delegate,
    // a lista vazia fazia TODA cidade sair com `hasStrategicRegion: false` —
    // afirmando "não tem região estratégica" sobre um modelo que o client nem
    // conhece. Agora exige o delegate; a resposta é falha, não negativa.
    exigirRegionDelegate().findMany({ select: { city: true, state: true } }),
  ])

  const chave = (city: string, state: string) => `${city}|${state}`
  const mapa = new Map<string, CityPresenceRow>()

  const garantir = (city: string, state: string): CityPresenceRow => {
    const k = chave(city, state)
    const existente = mapa.get(k)
    if (existente) return existente
    const nova: CityPresenceRow = {
      city,
      state,
      professionalCount: 0,
      tutorCount: 0,
      requestCount: 0,
      hasStrategicRegion: false,
    }
    mapa.set(k, nova)
    return nova
  }

  for (const p of profissionais) garantir(p.city, p.state).professionalCount = p._count
  for (const t of tutores) garantir(t.city, t.state).tutorCount = t._count

  // Marca quais cidades já têm camada estratégica. Comparação tolerante a
  // caixa/acento porque `Region.city` é cadastrado à mão no backoffice e não
  // passa pela mesma normalização dos perfis (ex.: "Carapicuiba" sem acento).
  for (const linha of mapa.values()) {
    linha.hasStrategicRegion = (regioes as Array<{ city: string; state: string }>).some(
      (r) => compareLocationText(r.city, linha.city) && r.state === linha.state
    )
  }

  // Solicitações por cidade DO PROFISSIONAL — mesmo critério territorial já
  // usado em `getRegionGrowthRows` (a request pertence a quem atende).
  const cidades = [...mapa.values()]
  await Promise.all(
    cidades.map(async (linha) => {
      linha.requestCount = await prisma.serviceRequest.count({
        where: {
          professional: { deletedAt: null, city: linha.city, state: linha.state },
        },
      })
    })
  )

  return cidades.sort(
    (a, b) =>
      b.professionalCount + b.tutorCount - (a.professionalCount + a.tutorCount) ||
      a.city.localeCompare(b.city, "pt-BR")
  )
}

export async function getRegionGrowthRows(): Promise<RegionGrowthRow[]> {
  const regionDelegate = exigirRegionDelegate()

  {
    const regions = await regionDelegate.findMany({
      orderBy: [{ city: "asc" }, { name: "asc" }],
      include: { neighborhoods: { select: { id: true } } },
    })

    if (regions.length === 0) return []

    const rows: RegionGrowthRow[] = []

    for (const region of regions) {
      const neighborhoodIds = region.neighborhoods.map((n) => n.id)

      const regionFilter = {
        OR: [
          { regionId: region.id },
          ...(neighborhoodIds.length > 0
            ? [{ neighborhoodId: { in: neighborhoodIds } }]
            : []),
        ],
      }

      const [
        professionalCount,
        tutorCount,
        partnerCount,
        trustAgg,
        requestCount,
        recurringCount,
        totalRelationships,
      ] = await Promise.all([
        prisma.professionalProfile.count({
          where: { deletedAt: null, ...regionFilter },
        }),
        prisma.tutorProfile.count({
          where: { deletedAt: null, ...regionFilter },
        }),
        prisma.partner.count({
          where: { isActive: true, regionId: region.id },
        }),
        prisma.professionalProfile.aggregate({
          where: { deletedAt: null, ...regionFilter },
          _avg: { trustScore: true },
        }),
        prisma.serviceRequest.count({
          where: {
            professional: {
              deletedAt: null,
              ...regionFilter,
            },
          },
        }),
        prisma.tutorProfessionalRelationship.count({
          where: {
            completedServices: { gte: 3 },
            professional: { deletedAt: null, ...regionFilter },
          },
        }),
        prisma.tutorProfessionalRelationship.count({
          where: { professional: { deletedAt: null, ...regionFilter } },
        }),
      ])

      const recurrenceRatio =
        totalRelationships > 0 ? recurringCount / totalRelationships : 0

      const metrics = computeTerritoryMetrics({
        professionalCount,
        requestCount,
        trustAvg: trustAgg._avg.trustScore ?? 0,
        recurrenceRatio,
        partnerCount,
      })

      const healthScore = computeHealthScore(metrics)

      rows.push({
        regionId:          region.id,
        regionName:        region.name,
        city:              region.city,
        state:             region.state,
        professionalCount,
        tutorCount,
        requestCount,
        recurrenceAvg:     Math.round(recurrenceRatio * 100),
        trustAvg:          Math.round(trustAgg._avg.trustScore ?? 0),
        partnerCount,
        metrics,
        healthScore,
        classification:    classifyHealthScore(healthScore),
      })
    }

    return rows.sort((a, b) => b.healthScore - a.healthScore)
  }
}

// ── Heatmap por cidade ────────────────────────────────────────────────────────

export async function getNeighborhoodHeatmap(cityFilter?: string): Promise<NeighborhoodHeatmapRow[]> {
  const neighborhoodDelegate = exigirNeighborhoodDelegate()

  {
    const where = cityFilter
      ? { city: { equals: cityFilter, mode: "insensitive" as const } }
      : {}

    const neighborhoods = await neighborhoodDelegate.findMany({
      where,
      orderBy: [{ city: "asc" }, { name: "asc" }],
      include: { region: { select: { name: true } } },
    })

    const rows: NeighborhoodHeatmapRow[] = []

    for (const nb of neighborhoods) {
      const filter = {
        OR: [
          { neighborhoodId: nb.id },
          {
            neighborhood: { equals: nb.name, mode: "insensitive" as const },
            city:         { equals: nb.city, mode: "insensitive" as const },
          },
        ],
      }

      const [professionals, requests, trustAgg, partners, recurring, totalRel] =
        await Promise.all([
          prisma.professionalProfile.count({ where: { deletedAt: null, ...filter } }),
          prisma.serviceRequest.count({
            where: { professional: { deletedAt: null, ...filter } },
          }),
          prisma.professionalProfile.aggregate({
            where: { deletedAt: null, ...filter },
            _avg: { trustScore: true },
          }),
          prisma.partner.count({
            where: {
              isActive: true,
              OR: [
                { neighborhoodId: nb.id },
                { city: { equals: nb.city, mode: "insensitive" } },
              ],
            },
          }),
          prisma.tutorProfessionalRelationship.count({
            where: {
              completedServices: { gte: 3 },
              professional: { deletedAt: null, ...filter },
            },
          }),
          prisma.tutorProfessionalRelationship.count({
            where: { professional: { deletedAt: null, ...filter } },
          }),
        ])

      const metrics = computeTerritoryMetrics({
        professionalCount: professionals,
        requestCount:      requests,
        trustAvg:          trustAgg._avg.trustScore ?? 0,
        recurrenceRatio:   totalRel > 0 ? recurring / totalRel : 0,
        partnerCount:      partners,
      })

      const healthScore = computeHealthScore(metrics)

      rows.push({
        neighborhoodId:   nb.id,
        neighborhoodName: nb.name,
        city:             nb.city,
        state:            nb.state,
        healthScore,
        starRating:       healthToStars(healthScore),
      })
    }

    return rows.sort((a, b) => b.healthScore - a.healthScore)
  }
}

export async function getDistinctCitiesForHeatmap(): Promise<string[]> {
  const neighborhoodDelegate = exigirNeighborhoodDelegate()

  {
    const rows = await neighborhoodDelegate.findMany({
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    })
    return rows.map((r) => r.city)
  }
}

// ── Discovery context ─────────────────────────────────────────────────────────

export async function getLocalDiscoveryContext(input: {
  city:             string | null
  neighborhood:     string | null
  neighborhoodId:   string | null
  regionId:         string | null
  trustedMinScore?: number
}): Promise<LocalDiscoveryContext> {
  const trustedMin = input.trustedMinScore ?? 25
  const messages: string[] = []

  if (!input.city) {
    return {
      trustedNearbyCount:   0,
      city:                 null,
      neighborhood:         null,
      region:               null,
      hasHighRecurrence:    false,
      communityRecommended: false,
      messages:             [],
    }
  }

  const geoFilter = {
    city: { equals: input.city, mode: "insensitive" as const },
    ...(input.neighborhoodId
      ? { neighborhoodId: input.neighborhoodId }
      : input.neighborhood
        ? { neighborhood: { equals: input.neighborhood, mode: "insensitive" as const } }
        : {}),
  }

  const [trustedNearby, recurrenceRatio, partnerEndorsements] = await Promise.all([
    prisma.professionalProfile.count({
      where: {
        deletedAt: null,
        trustScore: { gte: trustedMin },
        ...geoFilter,
      },
    }),
    computeRecurrenceRatioForGeo(geoFilter),
    input.city
      ? prisma.partner.count({
          where: { isActive: true, city: { equals: input.city, mode: "insensitive" } },
        })
      : Promise.resolve(0),
  ])

  /**
   * ───────────────────────────────────────────────────────────────────────────
   * FIX-002 — POR QUE AQUI NÃO SE EXIGE O DELEGATE
   *
   * Esta é a única leitura PÚBLICA do módulo: alimenta o `/discover` do tutor,
   * não o backoffice. Exigir o delegate derrubaria a busca de quem só quer um
   * profissional, por causa de um modelo que só o admin usa — quebrar o
   * Discovery por precaução é pior que o problema.
   *
   * E aqui a ausência não pode virar afirmação falsa, que é o critério da
   * missão. `regionName` só é resolvido quando `input.regionId` existe, é
   * OPCIONAL, e **não entra em nenhuma mensagem**: a página consome apenas
   * `localContext.messages`, e as três frases falam de cidade (ver o bloco de
   * copy abaixo). Sem delegate, `region` fica `null` — exatamente o que já
   * acontece hoje para 100% dos usuários, porque `regionId` está vazio em 21 de
   * 21 perfis.
   *
   * Ou seja: o campo degrada para o mesmo valor que ele já tem na prática, sem
   * produzir nenhuma afirmação territorial. Documentado em vez de corrigido.
   */
  let regionName: string | null = null
  if (input.regionId) {
    const regionDelegate = getRegionDelegate()
    if (regionDelegate) {
      const region = await regionDelegate.findUnique({
        where: { id: input.regionId },
        select: { name: true },
      })
      regionName = region?.name ?? null
    }
  }

  /**
   * ───────────────────────────────────────────────────────────────────────────
   * GATE-15 — O QUE ESTAS FRASES PODEM AFIRMAR
   *
   * Duas correções, as duas com evidência medida em PROD:
   *
   * 1. PLURAL QUEBRADO, visível em produção. O código anexava sufixo em vez de
   *    trocar a terminação, e a frase real era:
   *      "2 profissionalis confiáveleis próximos de você"
   *      "1 profissional confiável próximos de você"   ← singular + plural
   *
   * 2. "PRÓXIMOS DE VOCÊ" prometia proximidade que o dado não sustenta. A
   *    contagem é `professionalProfile.count()` por IGUALDADE DE CIDADE (e
   *    bairro em texto, quando houver) — não há distância, e `lat`/`lng` estão
   *    em 0 de 21 perfis. Em São Paulo, "próximo" podia ser 40 km. A frase
   *    passou a dizer o que a query realmente fez: mesma cidade.
   *
   * Pela mesma razão, "Região" e "Área" saíram: o recorte é a cidade, e
   * `regionId` está vazio em 100% dos perfis — chamar a cidade de "região"
   * empresta à frase a autoridade da camada estratégica, que aqui não existe.
   */
  if (trustedNearby > 0) {
    const plural = trustedNearby !== 1
    messages.push(
      `${trustedNearby} ${plural ? "profissionais confiáveis" : "profissional confiável"} em ${input.city}`
    )
  }

  const hasHighRecurrence = recurrenceRatio >= RECURRENCE_TRUSTED_THRESHOLD
  if (hasHighRecurrence) {
    messages.push("Cidade com alta recorrência de atendimentos")
  }

  const communityRecommended = partnerEndorsements >= 2
  if (communityRecommended) {
    messages.push("Cidade com parceiros Peteen ativos")
  }

  return {
    trustedNearbyCount:   trustedNearby,
    city:                 input.city,
    neighborhood:         input.neighborhood,
    region:               regionName,
    hasHighRecurrence,
    communityRecommended,
    messages,
  }
}

async function computeRecurrenceRatioForGeo(
  geoFilter: Record<string, unknown>
): Promise<number> {
  const [recurring, total] = await Promise.all([
    prisma.tutorProfessionalRelationship.count({
      where: {
        completedServices: { gte: 3 },
        professional: { deletedAt: null, ...geoFilter },
      },
    }),
    prisma.tutorProfessionalRelationship.count({
      where: { professional: { deletedAt: null, ...geoFilter } },
    }),
  ])
  return total > 0 ? recurring / total : 0
}

// ── Posição territorial (Trust Debug) ─────────────────────────────────────────

export async function getTerritorialPosition(
  professionalId: string
): Promise<TerritorialPosition | null> {
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: professionalId },
    select: {
      city: true,
      state: true,
      neighborhood: true,
      neighborhoodId: true,
      regionId: true,
      trustScore: true,
      regionRef: { select: { name: true } },
      neighborhoodRef: { select: { name: true } },
    },
  })

  if (!profile) return null

  const neighborhoodLabel =
    profile.neighborhoodRef?.name ?? profile.neighborhood ?? null

  const cityPros = await prisma.professionalProfile.findMany({
    where: { deletedAt: null, city: { equals: profile.city, mode: "insensitive" } },
    select: { id: true, trustScore: true },
    orderBy: { trustScore: "desc" },
  })

  const cityRankIdx = cityPros.findIndex((p) => p.id === professionalId)
  const rankInCity = cityRankIdx >= 0 ? cityRankIdx + 1 : null

  let rankInNeighborhood: number | null = null
  let totalInNeighborhood = 0

  if (profile.neighborhoodId || profile.neighborhood) {
    const nbFilter = profile.neighborhoodId
      ? { neighborhoodId: profile.neighborhoodId }
      : {
          neighborhood: { equals: profile.neighborhood!, mode: "insensitive" as const },
          city: { equals: profile.city, mode: "insensitive" as const },
        }

    const nbPros = await prisma.professionalProfile.findMany({
      where: { deletedAt: null, ...nbFilter },
      select: { id: true, trustScore: true },
      orderBy: { trustScore: "desc" },
    })

    totalInNeighborhood = nbPros.length
    const idx = nbPros.findIndex((p) => p.id === professionalId)
    rankInNeighborhood = idx >= 0 ? idx + 1 : null
  }

  return {
    neighborhood:       neighborhoodLabel,
    region:             profile.regionRef?.name ?? null,
    city:               profile.city,
    state:              profile.state,
    rankInNeighborhood,
    rankInCity:         rankInCity,
    totalInNeighborhood,
    totalInCity:        cityPros.length,
  }
}

// ── CRUD territorial ──────────────────────────────────────────────────────────

export async function createRegion(data: CreateRegionInput) {
  const regionDelegate = getRegionDelegate()
  if (!regionDelegate) throw new Error(GROWTH_DELEGATE_UNAVAILABLE)

  const slug = data.slug?.trim() || slugifyTerritory(data.name)
  // Normalização de escrita (Location Consistency V0.1) — city/state apenas.
  // `name` de Region NÃO passa por normalizeNeighborhoodName: semanticamente
  // é o nome da região (ex: "Zona Oeste"), não um bairro — aplicar a mesma
  // função alteraria o significado do campo.
  const location = normalizeLocationInput({ city: data.city, state: data.state })
  return regionDelegate.create({
    data: {
      city:  location.city ?? data.city.trim(),
      state: location.state ?? data.state.trim(),
      name:  data.name.trim(),
      slug,
    },
  })
}

export async function updateRegion(id: string, data: UpdateRegionInput) {
  const regionDelegate = getRegionDelegate()
  if (!regionDelegate) throw new Error(GROWTH_DELEGATE_UNAVAILABLE)

  // Normalização de escrita (Location Consistency V0.1) — city/state apenas
  // (ver nota em createRegion sobre `name`).
  const location = normalizeLocationInput({ city: data.city, state: data.state })
  return regionDelegate.update({
    where: { id },
    data: {
      ...(location.city !== undefined && { city: location.city }),
      ...(location.state !== undefined && { state: location.state }),
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.slug !== undefined && { slug: data.slug.trim() }),
    },
  })
}

export async function createNeighborhood(data: CreateNeighborhoodInput) {
  const neighborhoodDelegate = getNeighborhoodDelegate()
  if (!neighborhoodDelegate) throw new Error(GROWTH_DELEGATE_UNAVAILABLE)

  const slug = data.slug?.trim() || slugifyTerritory(data.name)
  // Normalização de escrita (Location Consistency V0.1). `name` aqui É o
  // nome do bairro (não há coluna separada "neighborhood" neste modelo) —
  // normalizeNeighborhoodName se aplica corretamente ao significado do campo.
  const location = normalizeLocationInput({ city: data.city, state: data.state })
  return neighborhoodDelegate.create({
    data: {
      city:     location.city ?? data.city.trim(),
      state:    location.state ?? data.state.trim(),
      name:     normalizeNeighborhoodName(data.name) ?? data.name.trim(),
      slug,
      regionId: data.regionId ?? null,
    },
  })
}

export async function updateNeighborhood(id: string, data: UpdateNeighborhoodInput) {
  const neighborhoodDelegate = getNeighborhoodDelegate()
  if (!neighborhoodDelegate) throw new Error(GROWTH_DELEGATE_UNAVAILABLE)

  // Normalização de escrita (Location Consistency V0.1) — ver nota em
  // createNeighborhood sobre `name`.
  const location = normalizeLocationInput({ city: data.city, state: data.state })
  return neighborhoodDelegate.update({
    where: { id },
    data: {
      ...(location.city !== undefined && { city: location.city }),
      ...(location.state !== undefined && { state: location.state }),
      ...(data.name !== undefined && {
        name: normalizeNeighborhoodName(data.name) ?? data.name.trim(),
      }),
      ...(data.slug !== undefined && { slug: data.slug.trim() }),
      ...(data.regionId !== undefined && { regionId: data.regionId }),
    },
  })
}

export async function listRegionsForSelect() {
  // FIX-002: devolvia [] sem o delegate, e o formulário de cadastro aparecia
  // sem nenhuma região para escolher — como se não houvesse nenhuma.
  return exigirRegionDelegate().findMany({
    select: { id: true, name: true, city: true, state: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  })
}
