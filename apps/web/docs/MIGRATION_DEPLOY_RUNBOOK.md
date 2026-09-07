# Migrations e deploy de schema — Peteen

Fonte de verdade sobre **quem é dono de qual parte do schema, o que já foi
aplicado, e como schema chega em cada ambiente**.

Criado em GATE-18-MIGRATION-DEPLOY-FOUNDATION-001, a partir de auditoria
somente-leitura. **Nada foi aplicado nem reconciliado neste gate** — a fase de
escrita depende de aprovação humana (ver "Plano de baseline").

Nenhum secret aparece aqui.

---

## O aviso que motiva este documento

> **Tracking e efeito são coisas diferentes, e neste banco elas discordam.**

No DEMO, a tabela `_prisma_migrations` **não existe** — nenhuma das 9 migrations
Prisma do repositório está registrada. Ainda assim, **todos os objetos que elas
criam existem no schema**. Ou seja: a pergunta "esta migration foi aplicada?"
não tem resposta pelo histórico; só pelo efeito.

Enquanto isso, `supabase_migrations.schema_migrations` guarda 18 registros cujo
SQL **não existe no repositório**.

Três fontes, três histórias. Este documento existe para que ninguém mais precise
descobrir isso do zero.

---

## Ownership — quem governa o quê

| Domínio | Dono | Onde vive |
|---|---|---|
| Schema da aplicação (`public`: tabelas, colunas, índices, enums, FKs) | **Prisma Migrate** | `apps/web/prisma/migrations/` |
| Buckets do Storage e policies de `storage.objects` | **Supabase migrations** | `supabase/migrations/` |
| Auth, Realtime, extensões | **Supabase (gerenciado)** | não versionado |

**Regra dura: nenhum objeto pode ter dois donos.** Prisma não escreve em
`storage.*`; migrations Supabase não criam tabela de negócio. Quando dois
trackers acham que possuem o mesmo objeto, o próximo conflito é silencioso.

---

## Estado medido — DEMO

Levantado com `npm run db:audit` (somente leitura, ver "Ferramentas").

### Tracking

| Tabela | Estado |
|---|---|
| `_prisma_migrations` | **AUSENTE** — a tabela não existe |
| `supabase_migrations.schema_migrations` | 18 registros, **nenhum com fonte no repositório** |
| `storage.migrations`, `auth.schema_migrations`, `realtime.schema_migrations` | internas do Supabase, não nossas |

### Reconciliação por efeito

| Migration | Origem | Tracking | Efeito | Veredito |
|---|---|---|---|---|
| `20250620120000_professional_availability_7_6` | prisma | não | 3/3 | UNTRACKED_BUT_PRESENT |
| `20260730180000_agenda_foundation_v0_3` | prisma | não | 4/4 | UNTRACKED_BUT_PRESENT |
| `20260801120000_service_uniqueness_concurrency_safety` | prisma | não | 1/1 | UNTRACKED_BUT_PRESENT |
| `20260808120000_push_notifications_foundation_v0` | prisma | não | 9/9 | UNTRACKED_BUT_PRESENT |
| `20260813120000_care_media_v0` | prisma | não | 6/6 | UNTRACKED_BUT_PRESENT |
| `20260817020000_push_vapid_environment_isolation` | prisma | não | 2/2 | UNTRACKED_BUT_PRESENT |
| `20260817030000_push_subscription_runtime_environment` | prisma | não | 1/1 | UNTRACKED_BUT_PRESENT |
| `20260820120000_notification_read_state` | prisma | não | 3/3 | UNTRACKED_BUT_PRESENT |
| `20260821120000_invite_visit_funnel` | prisma | não | 4/4 | UNTRACKED_BUT_PRESENT |
| `20260720000000_avatars_bucket_rls_policies` | supabase | não | **1/3** | **PARTIAL_DRIFT** |
| `20260813000000_care_media_private_bucket` | supabase | não | 1/1 | UNTRACKED_BUT_PRESENT |

**A boa notícia:** o schema do DEMO está completo em relação ao repositório.
Nenhuma migration está faltando de fato. O problema é de *registro*, não de
*estado* — e por isso é reparável sem executar DDL.

### Objetos sem fonte no repositório

Existem no banco, ninguém consegue recriá-los a partir do repo:

- **Buckets** `pets`, `documents`, `care-media-video`;
- **Policies** de `storage.objects` para `pets` e `documents` (7 no total);
- as **18 migrations** registradas em `supabase_migrations` (junho/2026).

### O drift de `avatars`

A migration do repositório declara 3 policies. No banco existe **uma** com o
nome do arquivo:

| Declarada no repo | Existe? |
|---|---|
| `Public read access for avatars` | ✅ |
| `Authenticated users can upload avatars` | ❌ |
| `Authenticated users can update avatars` | ❌ |

No lugar das duas ausentes há `avatars: authenticated upload`, `avatars: owner
update` e `avatars: owner delete` — nomes diferentes, criadas fora do
repositório, provavelmente pelo dashboard. **A permissão efetiva não está
quebrada; a procedência é que está.** O arquivo do repositório descreve um
estado que não é o real.

---

## Estado — PROD: **BLOQUEADO**

Não há canal de leitura disponível. A credencial local
(`.env.prod-cutover.local`, de 31/ago) falha com `28P01 password authentication
failed`. Foi feita **uma** tentativa de confirmação e nenhuma outra: buscar,
rotacionar ou regenerar segredo de produção não é ação de auditoria.

**Evidência que falta, e o que a destravaria** — qualquer uma das duas:

1. uma credencial de leitura de PROD válida e corrente; ou
2. um token da Management API do Supabase com escopo de leitura.

O recomendado é (1), na forma de um **role Postgres dedicado e somente-leitura**
para auditoria, em vez de reaproveitar o superusuário. Criar esse role é DDL —
está no plano abaixo, não neste gate.

Sem isso, ficam pendentes: tracking de PROD, efeito em PROD e **todo o eixo de
drift DEMO × PROD**. Não estimei nenhum deles por inferência.

---

## Como schema chega hoje em cada ambiente

Auditado, não presumido:

| Pergunta | Resposta |
|---|---|
| `next build` aplica schema? | **Não.** `build` é `prisma generate && next build` — só gera o client |
| Vercel PROD aplica migration? | **Não.** `buildCommand` é `null`, usa o `build` do `package.json` |
| Vercel DEMO aplica migration? | **Não.** Idem |
| CI aplica? | **Não.** O único workflow é o bot do orquestrador; não toca banco |
| Algum `postinstall`/hook? | **Nenhum** |

**Conclusão: hoje 100% do deploy de schema é manual, e não existe procedimento
escrito.** Deploy de aplicação e deploy de banco não têm ordem definida entre si
— o app pode subir esperando uma coluna que ninguém aplicou.

### O footgun que estava armado

`prisma.config.ts` resolve a URL do CLI como `DIRECT_URL ?? DATABASE_URL` e
carrega `dotenv/config`, que lê `apps/web/.env`. Esse arquivo contém uma
connection string **remota**. Logo:

```
npm run db:push      →  prisma db push     contra banco REMOTO
npm run db:migrate   →  prisma migrate dev contra banco REMOTO
```

`migrate dev` cria shadow database e, ao detectar drift, **se oferece para
resetar o banco**. A existência de `.env.prod-cutover.local` mostra que já houve
pelo menos uma vez em que essas variáveis apontaram para produção.

Isso agora está barrado por `scripts/prisma-guard.mjs` (ver "Comandos").

---

## Comandos — permitido e proibido por ambiente

| Comando | Local | DEMO | PROD |
|---|---|---|---|
| `npm run db:audit` | ✅ | ✅ | ✅ (quando houver credencial) |
| `npm run db:migrate:status` | ✅ | ✅ | ✅ |
| `npm run db:push` | ✅ livre | ⚠️ exige `-- --target=<ref>` | 🚫 **nunca** |
| `npm run db:migrate` (`migrate dev`) | ✅ livre | ⚠️ exige `-- --target=<ref>` | 🚫 **nunca** |
| `prisma migrate deploy` | — | ✅ (depois do baseline) | ✅ (depois do baseline + aprovação) |
| `prisma migrate resolve` | — | só no baseline aprovado | só no baseline aprovado |

**`db push` NUNCA é mecanismo de deploy de produção**, com ou sem confirmação:
ele aplica schema sem gerar migration, sem histórico e sem revisão. O guard
permite confirmar um destino remoto porque há usos legítimos em DEMO; ele não
transforma `db push` em procedimento de deploy.

O guard libera banco local sem cerimônia. Atrito onde não há risco é o que faz
as pessoas contornarem o guard.

---

## Ferramentas

| Comando | O que faz |
|---|---|
| `npm run db:audit` | Auditoria somente-leitura: tracking, reconciliação por efeito, objetos sem fonte |
| `npm run db:audit -- --env=.env.demo-rollback.local` | Idem, contra outro ambiente |
| `npm run db:migrate:status` | Status do Prisma (read-only) |

`scripts/migration-audit.mjs` roda **todas** as consultas dentro de
`BEGIN; SET TRANSACTION READ ONLY;`. Se alguém acrescentar uma escrita ali, o
Postgres recusa — a garantia é estrutural, não uma promessa do código.

---

## Plano de baseline — **requer aprovação humana, nada foi executado**

O objetivo é registrar o que já existe **sem executar DDL de novo**.

### Por que não basta rodar `migrate deploy`

Rodar `prisma migrate deploy` hoje faria o Prisma tentar aplicar as 9 migrations
do zero. Sete delas usam `IF NOT EXISTS` e passariam sem efeito, mas duas —
`20260820120000_notification_read_state` e `20260821120000_invite_visit_funnel` —
usam `CREATE TABLE`/`CREATE INDEX` **sem guarda** e **falhariam com erro**,
deixando o histórico pela metade.

Nenhuma delas destruiria dados: **as 11 migrations do repositório não têm um
único statement destrutivo executável.** Todos os `DROP TABLE`/`DROP COLUMN` que
aparecem nelas estão dentro de blocos `-- ROLLBACK` comentados.

### Fase 1 — snapshot (pré-requisito absoluto)

Backup/PITR confirmado nos dois projetos Supabase **antes de qualquer escrita**.
Sem snapshot verificado, nenhuma fase seguinte começa.

### Fase 2 — baseline do DEMO

Para cada uma das 9 migrations, em ordem cronológica:

```
npx prisma migrate resolve --applied <nome-da-migration>
```

`migrate resolve --applied` **não executa SQL**: ele cria `_prisma_migrations`
(se não existir) e registra a migration como já aplicada. É o caminho oficial de
baselining de banco existente, e é seguro precisamente porque já provamos, por
efeito, que os objetos existem.

Validar com `npm run db:migrate:status` → deve reportar tudo aplicado, sem
pendências.

### Fase 3 — validar DEMO

`npm run db:audit` novamente: todos os vereditos devem virar
`TRACKED_AND_PRESENT`. Smoke da aplicação. Só então PROD entra em pauta.

### Fase 4 — PROD

**Bloqueada até existir credencial de leitura.** A ordem é: auditar PROD →
comparar com DEMO → só então baselinear, com o mesmo `migrate resolve`, e apenas
para as migrations cujo efeito estiver comprovadamente presente lá. Migration
com efeito ausente em PROD **não** é baseline: é migration a aplicar, e isso é
outra decisão.

### Fase 5 — daqui para frente

1. Migration nova nasce local com `prisma migrate dev` contra banco **local**;
2. revisão do SQL gerado no PR;
3. **DEMO primeiro**: `prisma migrate deploy`, validar, smoke;
4. **PROD depois**, com aprovação explícita e snapshot recente;
5. app e schema sobem em ordem definida: schema aditivo antes do app; remoção de
   coluna só um deploy depois de o app parar de usá-la.

### Fase 6 — dívida que continua aberta

**Não é possível reconstruir este banco a partir do repositório.** As 18
migrations históricas não têm SQL versionado. A correção é gerar um baseline
consolidado a partir do schema real:

```
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Esse comando **não toca banco nenhum** (lê só o `schema.prisma`), mas cria
migration nova — fora do escopo deste gate. Fica como proposta.

### Ainda sem decisão

- **Drift de `avatars`**: alinhar o arquivo do repo à realidade, ou renomear as
  policies do banco. Requer decisão humana; envolve RLS.
- **Buckets e policies sem fonte** (`pets`, `documents`, `care-media-video`):
  escrever migrations que os descrevam, para que parem de ser invisíveis.
- **Role de leitura em PROD** para auditoria.

---

## Regras permanentes

1. **Snapshot antes de qualquer reconciliação.** Sem exceção.
2. **DEMO primeiro, sempre.** PROD só depois de validado em DEMO.
3. **`db push` nunca é deploy de PROD.**
4. **Um objeto, um dono.** Prisma ou Supabase, nunca os dois.
5. **Tracking não é prova.** Antes de afirmar que algo foi aplicado, verifique o
   efeito — foi assim que este documento descobriu tudo o que está aqui.
