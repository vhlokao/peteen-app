# Bootstrap relacional — estado atual para ambiente vazio

> **Este arquivo representa o estado relacional atual para reconstrução de
> ambiente vazio. Ainda não compõe a cadeia automática de migrations.**

`current_relational_baseline.sql` cria, num banco **vazio**, o schema relacional
atual do Peteen: 29 tabelas, 30 enums, 29 primary keys, 45 foreign keys e 139
índices. Nada além disso.

## O que este diretório NÃO é

| | |
|---|---|
| **NÃO é** migration automática — `prisma migrate deploy` não o executa |
| **NÃO é** histórico — para isso existe `supabase/history/recovered/` |
| **NÃO contém** RLS, policies, funções de segurança ou event trigger (Fase A) |
| **NÃO contém** Storage, buckets ou policies de `storage.objects` (Fase C) |
| **NÃO contém** `GRANT`, `REVOKE` ou default ACL — são específicos de ambiente |
| **NÃO contém** dados, seed ou tracking do Supabase |

A ausência desses objetos é **verificada por varredura**, não afirmada: o
`manifest.json` traz o resultado em `excludes_non_relational`, com 15 padrões
conferidos.

## Por que fica fora da cadeia automática

Porque a estratégia de tracking em **ambiente existente** ainda não foi
validada. DEMO e PROD já têm as 29 tabelas; aplicar um `CREATE TABLE` sobre elas
é, no melhor caso, ruído, e no pior, falha de migration. Colocar este arquivo em
`prisma/migrations/` agora decidiria essa questão por omissão — e a decisão
pertence ao dry-run da Fase B.

## Como foi gerado

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

Prisma 7.8.0, offline, sem contato com banco nenhum. **O arquivo é o resultado
puro do comando** — sem cabeçalho, sem edição manual, sem uma linha
acrescentada. Isso é deliberado: qualquer pessoa pode reexecutar o comando e
comparar o SHA-256 com o do manifesto. Um cabeçalho explicativo tornaria o
arquivo mais amigável e a verificação impossível.

Geração conferida duas vezes, hash idêntico. LF puro, sem CRLF.

## Reconciliação contra o estado vivo

Comparado com o catálogo do DEMO (`hxzlrfyelxmybghtbbxh`, leitura em
`SET TRANSACTION READ ONLY`), **catálogo contra catálogo** — o DDL foi carregado
num Postgres efêmero e os dois catálogos foram comparados, em vez de parsear SQL
com expressão regular:

| Dimensão | Resultado |
|---|---|
| Tabelas | 29 / 29 |
| Enums (valores **e ordem**) | 30 / 30 |
| Colunas (nome, tipo, nullability, default) | **361 / 361 idênticas** |
| Primary keys | 29 / 29, definição idêntica |
| Foreign keys (incl. `ON DELETE` / `ON UPDATE`) | 45 / 45, definição idêntica |
| Índices | 139 / 141 |

### As duas diferenças, e o que cada uma é

**1. `UNIQUE CONSTRAINT` vs `UNIQUE INDEX` — diferença física.**
Três objetos (`partners_slug_key`,
`trust_connections_sourceId_targetId_connectionType_key`,
`tutor_professional_relationships_tutorId_professionalId_key`) existem no DEMO
como constraint e aqui como índice único — **com definição de índice idêntica**.
A garantia de unicidade é a mesma; muda só o registro em `pg_constraint`. É a
mesma diferença física já documentada entre PROD e DEMO no GATE-015.

**2. Dois índices únicos parciais não são gerados — lacuna real e conhecida.**
`@@unique` do Prisma não expressa cláusula `WHERE`, então `migrate diff` não
emite:

| Índice | Fonte versionada |
|---|---|
| `services_professionalId_serviceType_active_key` | `prisma/migrations/20260801120000_service_uniqueness_concurrency_safety` |
| `verification_requests_one_pending_per_entity` | `supabase/history/recovered/20260620180520_verification_request_pending_unique_6_2.sql` |

Ambos têm fonte, e ambos precisam ser aplicados explicitamente no procedimento
de reconstrução — o baseline sozinho **não** os cria. Estão registrados no
manifesto em `known_completeness_gaps`.

## Rastreabilidade histórica

Das 29 tabelas, **26 têm origem histórica identificável**; dos 30 enums, **25**.
Sem histórico ficam exatamente os objetos que o AUDIT-012 já havia isolado —
confirmação independente, obtida por parser sobre as fontes:

- tabelas: `care_updates`, `partners`, `trust_connections`
- enums: `CareUpdateCategory`, `PartnerCategory`, `TrustConnectionType`,
  `TrustSourceType`, `TrustTargetType`

Para esses oito, a fonte de reconstrução é
**`LIVE_STATE_DERIVED + SCHEMA_PRISMA_CANONICAL`**: o `schema.prisma` os
representa, e a representação foi conferida coluna a coluna contra o estado
vivo. Nenhuma genealogia foi inventada.

## Trust, Trust Graph e Antifraude

Apenas reproduzidos. Verificado explicitamente:

- `TrustConnectionType`, `TrustSourceType`, `TrustTargetType`, `TrustEventType`
  e `TrustLevel` — valores **e ordem** idênticos ao vivo (ordem de enum é
  significativa em comparação e ordenação);
- `trust_connections.weight` — `integer NOT NULL`, idêntico;
- `trust_events.weight` — `double precision NOT NULL`, idêntico;
- colunas, FKs e índices de `trust_connections`, `trust_events` e
  `fraud_signals` — zero divergência.

Nenhuma regra foi reinterpretada, nenhum peso alterado, nenhuma semântica
ajustada.

## Reconstrução de ambiente vazio

A ordem vem da análise medida da interação com as 9 migrations Prisma (ver
`manifest.json` → `prisma_migrations_interaction`):

1. banco vazio;
2. **aplicar `current_relational_baseline.sql`**;
3. aplicar os 2 índices únicos parciais da tabela acima;
4. **marcar as 9 migrations Prisma como aplicadas** (`migrate resolve --applied`)
   — o baseline já contém o efeito de todas elas;
5. aplicar a camada de segurança da Fase A;
6. aplicar Storage da Fase C.

### Por que marcar como aplicadas, e não executar

Medido, não suposto: aplicando cada uma das 9 sobre o baseline num Postgres
efêmero, **duas falham**:

```
20260820120000_notification_read_state  -> [42P07] relation "notification_reads" already exists
20260821120000_invite_visit_funnel      -> [42P07] relation "invite_visits" already exists
```

As duas usam `CREATE TABLE` sem `IF NOT EXISTS`. As outras sete sobrevivem por
serem idempotentes — mas executá-las não acrescentaria nada, já que o baseline
contém 100% dos objetos que declaram.

**`migrate deploy` logo após o baseline, portanto, não funciona.** É exatamente
a armadilha que a análise existia para evitar.

## Ambientes existentes (DEMO / PROD)

**Não aplicar este baseline em DEMO nem em PROD.** As 29 tabelas já existem lá,
e o `_prisma_migrations` dos dois já registra as 9 migrations. Este arquivo
serve a ambiente novo.

## Como verificar a integridade

```bash
cd apps/web
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  | diff - prisma/bootstrap/current_relational_baseline.sql
```

Saída vazia significa que o baseline continua sendo exatamente o que o
`schema.prisma` atual produz. Se divergir, o `schema.prisma` mudou e o baseline
precisa ser regenerado — nunca editado à mão.
