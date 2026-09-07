# Migrations e deploy de schema — Peteen

Fonte de verdade sobre **quem é dono de qual parte do schema, o que já foi
aplicado, e como schema chega em cada ambiente**.

Criado em GATE-18-MIGRATION-DEPLOY-FOUNDATION-001, corrigido em **FIX-002**
(evidência de PROD, que inverteu as conclusões), **FIX-003** (validação
semântica de FK/PK/UNIQUE e guardrail de final de linha) e **FIX-004** (CHECK
por expressão, e a classificação de checksum corrigida para não deixar o estado
do worktree local esconder drift histórico do banco).
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
**constraints e FKs (semanticamente)**, enums, policies e buckets.

**Constraints são comparadas pelo que fazem, não pelo nome.** Conferir só o nome
responde "existe algo chamado assim?", e uma FK apontando para a tabela certa
com `ON DELETE NO ACTION` onde a migration pede `CASCADE` passaria — mudando o
comportamento do banco quando uma linha pai é apagada. A comparação cobre: tipo,
tabela dona, colunas locais (**na ordem**), tabela e colunas referenciadas,
`ON DELETE` e `ON UPDATE`.

Inclui também as constraints declaradas **inline em `CREATE TABLE`**, que é onde
vivem todas as 6 primary keys criadas por estas migrations e que a versão
anterior do auditor não enxergava. Total conferido: **13 constraints — 7 FKs e
6 PKs.** Nenhuma das 9 migrations Prisma declara CHECK nomeado hoje, mas o
comparador já cobre esse caso (ver abaixo) para quando alguma vier a declarar.

#### CHECK — comparado pela expressão, não só pelo nome

Mesmo defeito das FKs, outra forma: `CONSTRAINT "t_b" CHECK (b > 0)` e uma
constraint homônima real `CHECK (b > 100)` são regras DIFERENTES, e comparar só
nome+tabela+tipo as trataria como iguais.

O lado do banco usa `pg_get_constraintdef(con.oid)`, que devolve a definição
completa (`CHECK (<expressão>)`) — não existe uma coluna separada para "a
expressão do CHECK" em `pg_constraint`. O lado do repositório extrai a mesma
forma a partir do SQL da migration. Os dois passam pela MESMA normalização
antes de comparar, para que não haja duas regras de "o que é cosmético":

- aspas de **identificador** removidas (`"userId"` → `userId` — é o mesmo
  identificador; Postgres sempre devolve entre aspas, a migration pode não
  escrever assim);
- espaços em branco colapsados;
- parênteses externos **redundantes** removidos — só quando comprovadamente
  redundantes (o primeiro `(` fecha exatamente no último caractere; remover
  nunca muda o agrupamento).

**Não normalizado, de propósito:** aspas simples (são literal de string —
`'active'` e `active` são coisas diferentes), maiúsculas/minúsculas de
identificador, e casts que o Postgres injeta (`(x)::integer`). Um falso
`CONTENT_CHECKSUM_DRIFT`-equivalente para CHECK (que só pede revisão humana) é
preferível a um falso PASS que esconderia uma expressão realmente diferente.

Testes negativos exigidos e verificados: mesmo nome/tabela com limite diferente
(`b > 0` vs `b > 100`) reprova; coluna diferente (`b` vs `c`) reprova — a coluna
faz parte da expressão, então o texto normalizado já captura a troca; diferença
só de espaço em branco passa; CHECK ausente no banco reprova com uma única
divergência.

| Migration | Origem | Tracking | Efeito | Veredito |
|---|---|---|---|---|
| `20250620120000_professional_availability_7_6` | prisma | não | 5/5 | UNTRACKED_BUT_PRESENT |
| `20260730180000_agenda_foundation_v0_3` | prisma | não | 4/4 | UNTRACKED_BUT_PRESENT |
| `20260801120000_service_uniqueness_concurrency_safety` | prisma | não | 1/1 | UNTRACKED_BUT_PRESENT |
| `20260808120000_push_notifications_foundation_v0` | prisma | não | 13/13 | UNTRACKED_BUT_PRESENT |
| `20260813120000_care_media_v0` | prisma | não | 8/8 | UNTRACKED_BUT_PRESENT |
| `20260817020000_push_vapid_environment_isolation` | prisma | não | 2/2 | UNTRACKED_BUT_PRESENT |
| `20260817030000_push_subscription_runtime_environment` | prisma | não | 1/1 | UNTRACKED_BUT_PRESENT |
| `20260820120000_notification_read_state` | prisma | não | 5/5 | UNTRACKED_BUT_PRESENT |
| `20260821120000_invite_visit_funnel` | prisma | não | 7/7 | UNTRACKED_BUT_PRESENT |
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
`migration.sql`**, byte a byte.

**Final de linha muda o hash.** Este repositório é editado no Windows e o git
avisa "LF will be replaced by CRLF" a cada `add`. Por isso a matriz traz as duas
formas: sem elas, um falso alarme de drift é indistinguível de um real.

### O que o Prisma faz diante de checksum divergente — o que está PROVADO e o que não está

Versões anteriores deste documento afirmavam que o Prisma **recusa**
`migrate deploy` quando o checksum diverge. **Essa afirmação não foi
verificada**, e por isso foi removida daqui.

O que a evidência sustenta, extraída do binário do schema engine
(`node_modules/prisma/build/schema_engine_bg.wasm`, Prisma 7.8.0):

- existe o módulo `schema-engine/connectors/schema-connector/src/checksum.rs`;
- existe o campo de diagnóstico `editedMigrationNames`, ao lado de
  `databaseIsBehind`, `unappliedMigrationNames`, `historiesDiverge`,
  `failedMigrationNames` e `hasMigrationsTable`;
- existe a mensagem `` ` was modified after it was applied.``;
- existe `Drift detected: Your database schema is not in sync with your
  migration history.`;
- a coluna `checksum` faz parte do schema de `_prisma_migrations` que o engine
  cria.

Ou seja: **o Prisma reconhece e reporta migrations editadas.** O que *não* foi
provado é qual comando falha, com que severidade, e se há normalização de final
de linha na comparação.

**Por que não foi provado:** o teste exigiria aplicar migrations contra um banco
descartável, e nesta máquina não há Docker nem Postgres local; rodar contra DEMO
ou PROD está proibido pelo gate. Fica como verificação pendente, com o
procedimento: subir um Postgres local, `migrate deploy`, alterar o final de
linha de uma migration aplicada, rodar `migrate deploy` e `migrate status` de
novo, e registrar a saída literal.

Até lá, o plano trata a divergência como **potencialmente bloqueante** — que é a
postura conservadora — sem afirmar que é.

| Migration | SHA-256 (LF — forma canônica do repositório) |
|---|---|
| `20250620120000_professional_availability_7_6` | `9e24b1c88822b8a63d2e2d31049e3f583a4aff038cf77aec955e818188fef86f` |
| `20260730180000_agenda_foundation_v0_3` | `77f26c6cdde208f5cd83fc2a4dca4f7d2563ef889426535bcc5de38d9e08ac74` |
| `20260801120000_service_uniqueness_concurrency_safety` | `97d11961158a537adf16f9a36da8f8f930bdb14f2c74a7e3fcc749e770f436ad` |
| `20260808120000_push_notifications_foundation_v0` | `7c9b184c5a07211bbc35ce14fbd2d15ef7bffe29ca7a81890a5e2b6c1d5053da` |
| `20260813120000_care_media_v0` | `cc708c6459190fdec93906ab2f99633544a93f588972f3573421222bf7bfeb9a` |
| `20260817020000_push_vapid_environment_isolation` | `c986b070de7ac0005d342835c3576fcc6b3dfdda97f2efbf626c989a8799abb9` |
| `20260817030000_push_subscription_runtime_environment` | `60dd19b454570d603b60c864df213942d9c0ee7ba01ec1604e1370cbf256f947` |
| `20260820120000_notification_read_state` | `f7e7a73373b7e50424c050fa59eef57ce86a38de4e33240c4f8de51b91b93236` |
| `20260821120000_invite_visit_funnel` | `e1478eb6c539d8418a884098e60cf4b1e073481acf87922d26c646b83b842461` |

Para as 9, o blob versionado no git **bate com a forma LF** — ela é a canônica.

### Três eixos, não dois — e um bug real que veio de confundi-los

A classificação de checksum lida com TRÊS coisas distintas, e um bug do FIX-003
veio exatamente de tratar duas delas como se fossem uma só:

1. **Conteúdo canônico do repositório** — a forma LF do `migration.sql` atual,
   e sua forma CRLF equivalente (mesmo conteúdo, outro final de linha).
2. **Checksum gravado no banco** — o que `_prisma_migrations.checksum` guarda,
   congelado no momento em que a migration foi aplicada.
3. **Estado da árvore de trabalho** — como o arquivo está fisicamente NA
   MÁQUINA que está rodando a auditoria agora.

**O eixo 3 não pode influenciar a comparação entre 1 e 2.** O FIX-003 aceitava
a forma "disco" (bytes reais do arquivo `agora`) como uma das formas válidas de
MATCH. Depois que o `.gitattributes` normalizasse o worktree de alguém para LF,
`disco === lf` passaria a valer — e o checksum CRLF histórico gravado em PROD
seria classificado como "confere", escondendo exatamente o drift que a
auditoria existe para mostrar. Um auditor cujo veredito sobre o BANCO muda
porque um ARQUIVO DIFERENTE (`.gitattributes`) foi normalizado na máquina de
quem roda o comando não está medindo o banco.

**A correção:** `classificarChecksum()` agora recebe só `{ lf, crlf }` — as duas
formas do CONTEÚDO — e nunca consulta o worktree.

### Classificação — 4 classes

| Classe | Significado | Reação correta |
|---|---|---|
| `MATCH_CANONICAL` | banco == LF (a forma que o repositório considera certa) | nada |
| `FORMAT_ONLY_CHECKSUM_DRIFT` | banco == CRLF do MESMO conteúdo, mas != LF | normalizar o checkout que aplicou; **não** mexer no banco nem na migration |
| `CONTENT_CHECKSUM_DRIFT` | banco não bate com NENHUMA forma do conteúdo atual | **investigar**: alguém editou SQL já aplicado |
| `SEM_REGISTRO` | nada gravado para esta migration | migration não aplicada, ou tabela ausente |

Tratar `FORMAT_ONLY` e `CONTENT` como a mesma coisa leva a reações erradas e
opostas: ignorar um drift de conteúdo real, ou "consertar" um falso alarme
**reescrevendo uma migration já aplicada** — a única ação aqui capaz de
corromper o histórico de verdade.

O estado do worktree é reportado **à parte**, num vocabulário próprio que não
se mistura com o do banco: `WORKTREE_CANONICAL_LF`, `WORKTREE_CRLF`,
`WORKTREE_MIXED`.

### Resultado com a matriz real de PROD (fornecida pelo orquestrador)

```
professional_availability_7_6   FORMAT_ONLY_CHECKSUM_DRIFT (banco=CRLF, canonical=LF) ⚠   worktree=WORKTREE_CRLF   finished
```

- checksum gravado em PROD: `4d5febaf3940b4e0c9ecc2e4c3511973fde3b50536d6429d6eeb23a8e7461f18` — bate com a forma **CRLF** calculada a partir do conteúdo atual, não com a LF;
- LF canônico: `9e24b1c88822b8a63d2e2d31049e3f583a4aff038cf77aec955e818188fef86f`;
- classificação: **`FORMAT_ONLY_CHECKSUM_DRIFT`, nunca `MATCH_CANONICAL`** — travado em teste com estes dois hashes literais, para que uma regressão futura quebre a suíte, não só o relatório.

Note a correção de linguagem: o conteúdo de LF e CRLF é o mesmo conteúdo
**lógico** normalizado — mesmos statements, mesmos identificadores — não
"idêntico caractere a caractere" (versões anteriores deste documento usavam essa
frase; os bytes diferem exatamente no final de linha, que é a coisa toda).

**O que NÃO se faz:** editar `20250620120000_professional_availability_7_6`, e
não mexer em `_prisma_migrations`. A migration histórica fica como está.

### Guardrail: `.gitattributes`

`/.gitattributes` fixa `eol=lf` **apenas** para `migration.sql` e para as
migrations Supabase. Escopo estreito de propósito: uma regra ampla
(`* text=auto`) renormalizaria o repositório inteiro e produziria um diff enorme
sem relação com o problema.

Verificado que não altera conteúdo histórico: `git add --renormalize` sobre as
duas pastas de migrations não produziu **nenhuma** mudança de blob — os blobs já
estavam em LF, e a regra só impede a árvore de trabalho de divergir deles daqui
para frente.

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

#### Fase 2 — baseline do DEMO, **a partir de um checkout LF**
Para cada uma das 9, em ordem cronológica:
```
npx prisma migrate resolve --applied <nome-da-migration>
```
`migrate resolve --applied` **não executa SQL**: cria `_prisma_migrations` e
registra a migration como aplicada. É seguro **precisamente porque já provamos,
por efeito, que os objetos existem**.

**Pré-requisito explícito: rodar de um checkout com final de linha LF.** O
checksum gravado é o do arquivo em disco no momento do baseline. Baselinear a
partir de um checkout CRLF plantaria, no DEMO, uma divergência permanente contra
toda máquina e CI que use LF — criando de propósito o problema que o
`.gitattributes` acabou de resolver. Com o `.gitattributes` no lugar, um
checkout novo já vem em LF; conferir com `npm run db:audit`, que reporta o final
de linha de cada arquivo.

#### PROD e o checksum CRLF histórico
**PROD fica como está.** Se o checksum gravado lá para
`professional_availability_7_6` for o da forma CRLF, ele **permanece** — não se
reescreve `_prisma_migrations` para "alinhar formato". A auditoria reconhece as
duas formas como `MATCH`, então a divergência não gera alarme falso, e mexer no
histórico de produção por estética é risco sem contrapartida.

Isso vale enquanto ninguém precisar aplicar migration nova em PROD a partir de
um checkout LF. Quando isso for necessário, a pergunta a responder primeiro é a
que ficou pendente acima: **o Prisma realmente bloqueia?** Sem essa resposta,
não se decide se há algo a fazer.

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
