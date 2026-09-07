# Migrations e deploy de schema — Peteen

Fonte de verdade sobre **quem é dono de qual parte do schema, o que já foi
aplicado, e como schema chega em cada ambiente**.

Criado em GATE-18-MIGRATION-DEPLOY-FOUNDATION-001 e **corrigido em FIX-002**,
quando evidência de PROD ficou disponível e inverteu boa parte das conclusões.
**Nada foi aplicado nem reconciliado** — a fase de escrita depende de aprovação
humana (ver "Plano de baseline").

Nenhum secret aparece aqui.

---

## O aviso que motiva este documento

> **Tracking e efeito são coisas diferentes — e aqui os dois ambientes foram
> construídos por mecanismos diferentes.**

| | PROD | DEMO |
|---|---|---|
| `_prisma_migrations` | **EXISTE**, 9 registros, todos `finished`, nenhum rolled back | **AUSENTE** |
| `supabase_migrations.schema_migrations` | **AUSENTE** | **18 registros** |

São imagens espelhadas. PROD é a base **corretamente rastreada pelo Prisma**;
DEMO é a que tem histórico Supabase e nenhum rastro Prisma.

**A primeira versão deste documento afirmava que PROD estava sem tracking.**
Estava errada — o ponto era BLOCKED por falta de credencial, e a conclusão certa
teria sido "não sei", não uma extrapolação a partir do DEMO. A correção mudou o
plano de baseline de ponta a ponta: **PROD não precisa de baseline nenhum; DEMO
é o único candidato.**

---

## Ownership — quem governa o quê

| Domínio | Dono | Onde vive |
|---|---|---|
| Schema da aplicação (`public`: tabelas, colunas, índices, constraints, enums, FKs) | **Prisma Migrate** | `apps/web/prisma/migrations/` |
| Buckets do Storage e policies de `storage.objects` | **Supabase migrations** | `supabase/migrations/` |
| Auth, Realtime, extensões | **Supabase (gerenciado)** | não versionado |

**Regra dura: nenhum objeto pode ter dois donos.** Prisma não escreve em
`storage.*`; migrations Supabase não criam tabela de negócio.

---

## Estado — PROD

**Rastreado pelo Prisma e íntegro.** As 9 migrations do repositório estão em
`_prisma_migrations`, todas `finished`, nenhuma com `rolled_back_at`.

Não há `supabase_migrations.schema_migrations` — ou seja, as 18 migrations
históricas que o DEMO registra **nunca foram registradas aqui**, ainda que seus
efeitos existam (as tabelas de negócio estão lá; a aplicação roda).

> **Procedência desta seção:** evidência levantada por quem tem acesso ao
> projeto de produção e repassada ao gate. **Não foi verificada de forma
> independente pelo executor**, cuja credencial local segue inválida
> (`28P01`). Está registrada como reportada, não como medida — a distinção
> importa exatamente num documento cujo tema é "tracking pode mentir".

### O que falta confirmar em PROD

Uma consulta somente-leitura fecha o único ponto aberto (checksums):

```sql
select migration_name, checksum, finished_at, rolled_back_at
  from _prisma_migrations
 order by started_at;
```

Compare a coluna `checksum` com a tabela da seção "Matriz de checksums".

---

## Estado — DEMO

### Tracking

| Tabela | Estado |
|---|---|
| `_prisma_migrations` | **AUSENTE — a tabela não existe** |
| `supabase_migrations.schema_migrations` | **18 registros**, nenhum com fonte no repositório |

### Reconciliação por efeito

Verificada pelos objetos que cada migration cria — tabelas, colunas, índices,
**constraints e FKs**, enums, policies e buckets.

| Migration | Origem | Tracking | Efeito | Veredito |
|---|---|---|---|---|
| `20250620120000_professional_availability_7_6` | prisma | não | 4/4 | UNTRACKED_BUT_PRESENT |
| `20260730180000_agenda_foundation_v0_3` | prisma | não | 4/4 | UNTRACKED_BUT_PRESENT |
| `20260801120000_service_uniqueness_concurrency_safety` | prisma | não | 1/1 | UNTRACKED_BUT_PRESENT |
| `20260808120000_push_notifications_foundation_v0` | prisma | não | 11/11 | UNTRACKED_BUT_PRESENT |
| `20260813120000_care_media_v0` | prisma | não | 7/7 | UNTRACKED_BUT_PRESENT |
| `20260817020000_push_vapid_environment_isolation` | prisma | não | 2/2 | UNTRACKED_BUT_PRESENT |
| `20260817030000_push_subscription_runtime_environment` | prisma | não | 1/1 | UNTRACKED_BUT_PRESENT |
| `20260820120000_notification_read_state` | prisma | não | 4/4 | UNTRACKED_BUT_PRESENT |
| `20260821120000_invite_visit_funnel` | prisma | não | 6/6 | UNTRACKED_BUT_PRESENT |
| `20260720000000_avatars_bucket_rls_policies` | supabase | não | **1/3** | **PARTIAL_DRIFT** |
| `20260813000000_care_media_private_bucket` | supabase | não | 1/1 | UNTRACKED_BUT_PRESENT |

O schema do DEMO está completo em relação ao repositório. O problema é de
*registro*, não de *estado* — por isso é reparável sem executar DDL.

### Objetos sem fonte no repositório
Buckets `pets`, `documents`, `care-media-video`; policies de `storage.objects`
para `pets` e `documents`; e as 18 migrations de junho/2026.

### O drift de `avatars`
A migration do repositório declara 3 policies; existe **uma** com aquele nome:

| Declarada no repo | No DEMO |
|---|---|
| `Public read access for avatars` | ✅ |
| `Authenticated users can upload avatars` | ❌ |
| `Authenticated users can update avatars` | ❌ |

No lugar delas há `avatars: authenticated upload`, `avatars: owner update` e
`avatars: owner delete`. **A permissão efetiva não está quebrada; a procedência
é que está.**

---

## As 3 UNIQUE que só existem no DEMO

São estas:

| Tabela | Constraint |
|---|---|
| `partners` | `partners_slug_key` |
| `trust_connections` | `trust_connections_sourceId_targetId_connectionType_key` |
| `tutor_professional_relationships` | `tutor_professional_relationships_tutorId_professionalId_key` |

### O que exatamente difere

No Postgres há **duas formas** de garantir unicidade, e elas vivem em catálogos
diferentes:

| Forma | `pg_constraint` | `pg_indexes` |
|---|---|---|
| `ALTER TABLE … ADD CONSTRAINT … UNIQUE` | linha `contype='u'` | índice de apoio, mesmo nome |
| `CREATE UNIQUE INDEX` | **nada** | índice |

Medido no DEMO: **3** na forma de constraint, 30 primary keys, **20** apenas
índice. Em PROD, essas 3 não aparecem como constraint.

### Por que a diferença existe

As três tabelas **não são criadas por nenhuma migration do repositório** — vêm
do lote de 18 migrations históricas de junho, cujo SQL se perdeu. Aquele SQL era
escrito à mão e usou `ADD CONSTRAINT`. PROD, que nunca registrou esse lote,
recebeu a unicidade equivalente pelo caminho do Prisma, que emite
`CREATE UNIQUE INDEX`.

O `schema.prisma` **não distingue as duas formas** — ambas são `@@unique`. Foi
por isso que a divergência sobreviveu meses sem ninguém notar: ela é invisível
no modelo e só aparece no catálogo.

### O que isso quebra, e o que não quebra

- **Integridade de dados: nada.** As duas formas rejeitam duplicata igualmente.
- **`ON CONFLICT ON CONSTRAINT <nome>`** exige constraint real e falharia em
  PROD. **Verificado: o código não usa essa forma em lugar nenhum.**
- **O risco real é de ferramenta.** `prisma migrate diff` compara catálogo, não
  comportamento. Um baseline gerado por diff veria os dois bancos como
  diferentes e poderia propor DDL para converter uma forma na outra — o que
  significa dropar e recriar constraint em tabela viva. **Este é o motivo de o
  baseline não poder ser gerado por diff sem revisão humana do SQL.**

---

## Matriz de checksums — 9 migrations Prisma

O Prisma grava em `_prisma_migrations.checksum` o **SHA-256 hex do conteúdo de
`migration.sql`**, byte a byte. Divergência de checksum faz o Prisma tratar a
migration como **modificada** e recusar `migrate deploy`.

**Final de linha muda o hash.** Este repositório é editado no Windows e o git
avisa "LF will be replaced by CRLF" a cada `add`. Por isso a matriz traz as duas
formas: sem elas, um falso alarme de drift é indistinguível de um real.

| Migration | SHA-256 (LF — forma canônica do git) | Disco == LF? |
|---|---|---|
| `20250620120000_professional_availability_7_6` | `9e24b1c88822b8a63d2e2d31049e3f583a4aff038cf77aec955e818188fef86f` | **NÃO — está CRLF** |
| `20260730180000_agenda_foundation_v0_3` | `77f26c6cdde208f5cd83fc2a4dca4f7d2563ef889426535bcc5de38d9e08ac74` | sim |
| `20260801120000_service_uniqueness_concurrency_safety` | `97d11961158a537adf16f9a36da8f8f930bdb14f2c74a7e3fcc749e770f436ad` | sim |
| `20260808120000_push_notifications_foundation_v0` | `7c9b184c5a07211bbc35ce14fbd2d15ef7bffe29ca7a81890a5e2b6c1d5053da` | sim |
| `20260813120000_care_media_v0` | `cc708c6459190fdec93906ab2f99633544a93f588972f3573421222bf7bfeb9a` | sim |
| `20260817020000_push_vapid_environment_isolation` | `c986b070de7ac0005d342835c3576fcc6b3dfdda97f2efbf626c989a8799abb9` | sim |
| `20260817030000_push_subscription_runtime_environment` | `60dd19b454570d603b60c864df213942d9c0ee7ba01ec1604e1370cbf256f947` | sim |
| `20260820120000_notification_read_state` | `f7e7a73373b7e50424c050fa59eef57ce86a38de4e33240c4f8de51b91b93236` | sim |
| `20260821120000_invite_visit_funnel` | `e1478eb6c539d8418a884098e60cf4b1e073481acf87922d26c646b83b842461` | sim |

Para os 9, o blob versionado no git **bate com a forma LF** — ela é a canônica.
A única com CRLF na árvore de trabalho é `professional_availability_7_6`; seu
hash em disco é `4d5febaf3940b4e0c9ecc2e4c3511973fde3b50536d6429d6eeb23a8e7461f18`.

**Como comparar:** rode a consulta da seção "Estado — PROD" e confronte a coluna
`checksum` com a coluna LF acima. `npm run db:audit` faz isso automaticamente
quando alcança um banco que tenha `_prisma_migrations`.

Se algum divergir, **não edite o arquivo da migration** para "consertar o hash":
isso reescreve história já aplicada. Investigue primeiro qual das duas mudou.

---

## Como schema chega hoje em cada ambiente

| Pergunta | Resposta |
|---|---|
| `next build` aplica schema? | **Não.** `prisma generate && next build` — só gera o client |
| Vercel PROD aplica migration? | **Não.** `buildCommand` = `null` |
| Vercel DEMO aplica migration? | **Não.** Idem |
| CI aplica? | **Não.** O único workflow é o bot do orquestrador |
| `postinstall`/hooks? | **Nenhum** |

**100% do deploy de schema é manual.** Deploy de aplicação e de banco não têm
ordem definida entre si.

### O footgun

`prisma.config.ts` resolve a URL do CLI como `DIRECT_URL ?? DATABASE_URL` e
carrega `dotenv/config`, que lê `apps/web/.env` — que contém uma connection
string **remota**. Sem guard, `npm run db:push` e `npm run db:migrate`
alcançavam banco remoto sem uma única pergunta, e `migrate dev` se oferece para
**resetar** ao detectar drift.

---

## Comandos — permitido e proibido por ambiente

| Comando | Local | DEMO | PROD |
|---|---|---|---|
| `npm run db:audit` | ✅ | ✅ | ✅ |
| `npm run db:migrate:status` | ✅ | ✅ | ✅ |
| `npm run db:push` | ✅ livre | ⚠️ exige `-- --target=<ref>` | 🚫 **bloqueado no código** |
| `npm run db:migrate` (`migrate dev`) | ✅ livre | ⚠️ exige `-- --target=<ref>` | 🚫 **bloqueado no código** |
| `prisma migrate deploy` | — | ✅ após baseline | ✅ com aprovação + snapshot |
| `prisma migrate resolve` | — | só no baseline aprovado | **não é necessário** |

**Produção é bloqueio incondicional em `db push` e `migrate dev`.** Não existe
`--target` que libere — `scripts/prisma-guard.mjs` reconhece a referência do
projeto de produção e recusa antes de qualquer conexão. A referência está no
código porque ela é pública por construção (vai no bundle de
`www.peteen.com.br`), e porque uma env var pode ser esvaziada justamente na
máquina onde alguém está com pressa.

O guard libera banco local sem cerimônia: atrito onde não há risco é o que faz
as pessoas contornarem o guard.

---

## Ferramentas

| Comando | O que faz |
|---|---|
| `npm run db:audit` | Auditoria somente-leitura: tracking, reconciliação por efeito (incl. constraints/FKs), forma das UNIQUE, checksums, objetos sem fonte |
| `npm run db:audit -- --env=<arquivo>` | Idem, contra outro ambiente |
| `npm run db:migrate:status` | Status do Prisma (read-only) |

`scripts/migration-audit.mjs` roda **tudo** dentro de
`BEGIN; SET TRANSACTION READ ONLY`. Se alguém acrescentar escrita ali, quem
recusa é o Postgres, não o arquivo.

---

## Plano de baseline — **requer aprovação humana; nada foi executado**

### PROD: nada a fazer
Já está rastreado, com as 9 migrations `finished` e nenhuma revertida. **Não
precisa de `migrate resolve`, não precisa de baseline.** Só falta a conferência
de checksum descrita acima.

### DEMO: é o único candidato a baseline

O objetivo é registrar o que já existe **sem executar DDL**.

**Por que não rodar `migrate deploy` no DEMO.** O Prisma tentaria aplicar as 9
do zero. Sete passariam sem efeito (`IF NOT EXISTS`), mas
`20260820120000_notification_read_state` e `20260821120000_invite_visit_funnel`
usam `CREATE TABLE`/`CREATE INDEX` **sem guarda** e **falhariam com erro**,
deixando o histórico pela metade. Nenhuma destruiria dados: **as 11 migrations
do repositório não têm um único statement destrutivo executável** — todos os
`DROP TABLE`/`DROP COLUMN` estão em blocos `-- ROLLBACK` comentados.

#### Fase 1 — snapshot
Backup/PITR **confirmado** no projeto DEMO. Sem snapshot verificado, nada começa.

#### Fase 2 — baseline do DEMO
Para cada uma das 9, em ordem cronológica:
```
npx prisma migrate resolve --applied <nome-da-migration>
```
`migrate resolve --applied` **não executa SQL**: cria `_prisma_migrations` e
registra a migration como aplicada. É seguro **precisamente porque já provamos,
por efeito, que os objetos existem**.

Antes disso, conferir o final de linha de `professional_availability_7_6`: se o
checkout local estiver com CRLF, o checksum gravado será o CRLF e divergirá de
qualquer máquina com LF. Baselinear a partir de um checkout LF evita plantar
essa divergência.

#### Fase 3 — validar
`npm run db:audit` → todos os vereditos viram `TRACKED_AND_PRESENT`, e a seção
de checksum deve fechar. `npm run db:migrate:status` sem pendências. Smoke.

#### Fase 4 — daqui para frente
1. Migration nasce local com `prisma migrate dev` contra banco **local**;
2. revisão do SQL no PR;
3. **DEMO primeiro**: `migrate deploy`, validar, smoke;
4. **PROD depois**, com aprovação explícita e snapshot recente;
5. schema aditivo antes do app; remoção de coluna só um deploy **depois** de o
   app parar de usá-la.

#### Fase 5 — rollback
Snapshot/PITR do Supabase. As seções `-- ROLLBACK` das migrations são
documentação, não procedimento aprovado — várias destruiriam dados.

### Dívida que continua aberta

**Não é possível reconstruir estes bancos a partir do repositório**: as 18
migrations históricas não têm SQL versionado. A correção proposta é um baseline
consolidado gerado do schema:
```
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```
Não toca banco nenhum, mas cria migration nova — e, pelo que a seção das 3
UNIQUE mostra, o SQL gerado **precisa de revisão humana** antes de virar
verdade: um diff de catálogo não sabe que constraint e índice único são
equivalentes para o negócio.

### Sem decisão ainda
- **Drift de `avatars`** — alinhar o repo à realidade ou renomear as policies.
- **Buckets/policies sem fonte** — `pets`, `documents`, `care-media-video`.
- **As 3 UNIQUE** — unificar a forma entre ambientes, ou aceitar a divergência e
  documentá-la como permanente. Unificar é DDL em tabela viva.
- **Credencial de leitura de PROD** para o executor, idealmente um role
  dedicado somente-leitura.

---

## Regras permanentes

1. **Snapshot antes de qualquer reconciliação.**
2. **DEMO primeiro, sempre.**
3. **`db push` nunca é deploy de PROD** — e agora o código impede.
4. **Um objeto, um dono.**
5. **Tracking não é prova.** Verifique o efeito.
6. **"Não sei" não vira extrapolação.** Foi assim que a primeira versão deste
   documento errou sobre PROD: partiu do que via no DEMO em vez de dizer que o
   ponto estava bloqueado.
