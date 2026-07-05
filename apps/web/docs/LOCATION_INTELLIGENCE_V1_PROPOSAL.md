# Location Intelligence — Proposta V1/V2

**Status:** proposta — nada além da Foundation V0 está implementado.
**Pré-leitura:** `docs/LOCATION_PRIVACY_POLICY.md`.

## Estado encontrado na auditoria (2026-07-05)

### Campos existentes no schema (nenhuma migration necessária na V0)

| Modelo | Campos geo | Estado real dos dados |
|---|---|---|
| `TutorProfile` | `city`, `state`, `neighborhood?`, `lat?`, `lng?`, `neighborhoodId?`, `regionId?` | texto livre; lat/lng sempre null; FKs nunca preenchidas |
| `ProfessionalProfile` | idem + `serviceRadiusKm? @default(10)` | idem; serviceRadiusKm nunca coletado (default morto) |
| `PartnerProfile` | como TutorProfile | geo nunca escrito por código |
| `Partner` | `city`, `state`, `neighborhood?`, FKs | neighborhood nunca escrito (campo morto) |
| `Region` / `Neighborhood` | `city`, `state`, `name`, `slug` (+`regionId` no bairro) | 2 regiões, 1 bairro; texto de cidade sem acento nas próprias entidades |
| `User` | — | nenhum campo geo |

Não existe endereço/CEP em nenhum modelo. Não existe Territory/ServiceArea —
Region+Neighborhood **são** o modelo territorial do Growth Engine.

### Inconsistências encontradas

1. **FKs territoriais órfãs:** `neighborhoodId`/`regionId` nos 4 perfis são
   lidas (recommendation, growth, discover) mas **nunca escritas** — todo o
   matching territorial degrada para fallback textual.
2. **Normalização de escrita inconsistente:** `state` é uppercased nos zod
   de tutor/profissional e no partner-portal, mas NÃO no admin
   (`createPartner`/`updatePartner`) nem no growth CRUD (só trim). `city` é
   trimada só em partners/growth; tutor/profissional gravam cru.
3. **4 padrões de formatação coexistiam** na UI: `{city}, {state}`,
   `{city}` sozinho, `{city} / {state}`, `{city} · {neighborhood}` —
   unificados na V0 via `resolvePublicLocation` nos consumidores críticos.
4. **Projeção pública vaza campos internos:** `ProfessionalPublicProfile`
   inclui `lat`/`lng`/`serviceRadiusKm` (hoje sempre null/default e nunca
   renderizados — risco teórico, bloqueante antes da V1 coletar esses dados).
5. As próprias entidades `Region`/`Neighborhood` têm cidade sem acento
   ("Carapicuiba") — o resolver da V0 normaliza também o caminho estruturado.

## Foundation V0 — implementado agora

- `modules/location` — domain puro: normalização (trim, colapso de espaços,
  capitalização pt-BR, UF canônica, acento restaurado **só** via dicionário
  explícito `KNOWN_CITIES`), comparação case/accent-insensitive,
  `formatPublicLocation`, `resolvePublicLocation` (estruturado > texto >
  parcial > não informado), `resolveLocationCompleteness` (COMPLETE /
  NEIGHBORHOOD_MISSING / CITY_ONLY / MISSING — interno, sem score, sem
  bloqueio).
- Filtro opcional por bairro no Discovery (`neighborhood` searchParam +
  input), comparação case-insensitive no banco, input normalizado na action.
  Sem filtro, comportamento idêntico ao anterior. Elegibilidade pública
  (serviço ativo) preservada. Ranking/Recommendation intocados.
- Consumidores críticos de UI usando o resolver central (Discovery card,
  hero público, página de parceiro, previews, RecommendationSection).
- Testes unitários (`npm run test:location`, node:test nativo).

### Limitações conhecidas da V0 (aceitas e documentadas)

- **Accent-insensitivity no banco:** o match de bairro/cidade no Postgres é
  case-insensitive (`mode: "insensitive"`), não accent-insensitive. Cidades
  do dicionário ganham accent-insensitivity prática porque o input é
  canonicalizado antes da query; bairros não têm dicionário — "Vila Isa" vs
  "vila isá" não casam. Resolver na V1 (unaccent do Postgres ou slug).
- Filtro de bairro é textual — quando as FKs territoriais forem preenchidas,
  migrar para filtro estruturado por `neighborhoodId`.
- A escrita de perfis continua gravando texto cru (normalização na escrita é
  mudança de comportamento de formulários — fora do escopo V0).

## V1 — depois dos primeiros testes reais

Pré-requisito bloqueante: estreitar `ProfessionalPublicProfile` removendo
`lat`/`lng`/`serviceRadiusKm` da projeção pública.

1. **Normalização na escrita:** aplicar `modules/location` nos zod schemas /
   actions de onboarding e edição (tutor, profissional, parceiro, growth) —
   dados nascem limpos em vez de serem limpos na leitura.
2. **Vincular FKs territoriais:** ao salvar perfil, resolver
   `neighborhoodId`/`regionId` por comparação normalizada contra
   `Neighborhood`/`Region` existentes (sem inventar vínculo se não houver
   match). Backfill idempotente para os perfis atuais.
3. **CEP (opcional, privado):** coleta para geocoding server-side; nunca
   exibido; validade da política de privacidade.
4. **Geocoding + lat/lng internos:** provider a definir; coordenadas nunca
   serializadas ao client (ver política).
5. **Área de atendimento real:**
   - base location do profissional (bairro/região, não endereço);
   - serviços no local do tutor vs no local do profissional (flag por
     `Service`);
   - raio por serviço (`serviceRadiusKm` sai do default morto e vira dado
     coletado por serviço ou por perfil);
   - lista de bairros atendidos (join table `ProfessionalNeighborhood` —
     exige migration, autorização explícita);
   - exceções (bairros excluídos dentro do raio).
6. **Distância aproximada na UI** ("~2 km", "mesmo bairro") — derivado
   seguro, nunca coordenada.
7. **unaccent/slug matching** no Postgres para busca accent-insensitive.

## V2 — engines (autorização explícita obrigatória)

- Peso contextual de proximidade no Ranking (nunca dominante — proximidade
  informa, confiança decide; ranking não prioriza preço nem distância pura).
- Recommendation com contexto territorial real (mesmo bairro/região via FKs,
  substituindo o fallback textual atual).
- Growth: densidade local, cold start geográfico (profissional novo em bairro
  sem oferta ganha exposição contextual, não score inflado).
- Antifraude geográfico (padrões impossíveis de deslocamento, recorrência
  artificial concentrada).

## O que depende dos testes reais

- Se tutores buscam por bairro ou só por cidade (decide prioridade do item
  V1.2 vs V1.5).
- Se profissionais entendem "área de atendimento" como bairros ou como raio
  (decide o modelo de persistência da V1.5).
- Se a exibição pública de bairro nos cards aumenta confiança ou gera
  desconforto (decide a pendência de UI adiada na política de privacidade).
