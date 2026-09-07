# Histórico recuperado — 18 migrations do tracking Supabase

> **Estes arquivos NÃO compõem a cadeia executável oficial de migrations.
> Não devem ser movidos ou aplicados automaticamente sem reconciliação e autorização.**

Transcrição literal do SQL das 18 migrations históricas do Peteen, resgatado de
`supabase_migrations.schema_migrations` do ambiente **DEMO**. É material
**documental e de consolidação** — evidência, não cadeia de execução.

## Por que este diretório existe

Durante o `GATE-18-RECONSTRUCTION-CLOSURE-AUDIT-012` descobriu-se que a tabela
de tracking do Supabase guarda o SQL integral de cada migration na coluna
`statements`. Isso converteu 18 migrations tidas como "órfãs" — cujo arquivo
original não existe no repositório — em histórico recuperável e verificável.

O `GATE-18-PROD-RECONSTRUCTION-RECONCILIATION-015` transformou isso em urgência:
**PROD não possui o schema `supabase_migrations`**. Ou seja, o DEMO é hoje a
**única cópia viva** desse SQL — e é o mais descartável dos dois ambientes.
Recriar ou perder o DEMO apagaria a origem documental de 20 das 30 tabelas e 24
dos 30 enums do produto.

Este diretório encerra esse risco de fonte única.

## O que é e o que não é

| | |
|---|---|
| **É** | transcrição byte-a-byte do que foi efetivamente aplicado no passado |
| **É** | insumo para a consolidação forward-only (Fase B do plano do Gate 18) |
| **É** | evidência de proveniência: responde "de onde veio este objeto?" |
| **NÃO é** | a cadeia executável oficial |
| **NÃO é** | o estado desejado atual |
| **NÃO é** | idempotente, revisado, corrigido ou modernizado |

### Nada aqui foi corrigido

A transcrição é literal e deliberadamente não curada. Não houve correção de SQL,
conversão para idempotente, reformatação, modernização, remoção ou acréscimo de
statements, nem adaptação para PROD ou DEMO. Se uma migration histórica contém
algo que hoje seria escrito de outro jeito, ela permanece como está — o valor
deste diretório está exatamente em ser fiel ao que rodou.

## Origem e integridade

- **Ambiente de origem:** DEMO, project ref `hxzlrfyelxmybghtbbxh`
- **Tabela de origem:** `supabase_migrations.schema_migrations`
- **Modo de leitura:** `BEGIN; SET TRANSACTION READ ONLY;` — zero writes
- **Total:** 18 migrations, todas com 1 statement, todas em LF puro
- **Separador de concatenação:** `\n` (LF), aplicado ao `join` do ARRAY
  `statements` na ordem original do campo
- **Verificação:** SHA-256 do SQL lido do banco comparado com SHA-256 do arquivo
  relido do disco — **18/18 conferindo**

O `manifest.json` deste diretório registra, por migration: `version`, `name`,
número de statements, tamanho em bytes, `source_sha256`, `file_sha256`,
classificação `RECOVERED_HISTORICAL_SOURCE` e `executable: false`.

**Hash agregado:** `9e8f46bc1570ab815554c558e2f8808cff330dc028d12540352072a68481cb7e`
(sha256 das linhas `<version>\t<name>\t<source_sha256>` ordenadas por `version`,
unidas por `\n` — receita registrada no manifest).

### Final de linha é parte da garantia

As 18 vieram do banco em LF puro. A regra
`**/supabase/history/recovered/*.sql text eol=lf` no `.gitattributes` da raiz
existe para que um clone em máquina com `core.autocrlf=true` não converta para
CRLF — o que faria todo hash do manifest divergir do arquivo em disco sem que
uma única linha de SQL tivesse mudado.

## Por que não fica em `supabase/migrations/`

Porque aquele diretório é lido automaticamente. Verificado antes de escolher
este caminho:

- `apps/web/scripts/migration-audit.mjs` aponta `SUPABASE_DIR` para
  `<raiz>/supabase/migrations` e faz `readdirSync` **não-recursivo**, filtrando
  `.sql`. Um subdiretório sob `supabase/history/` está fora do alcance dele.
- Não existe no repositório nenhum loader que varra `supabase/**/*.sql`
  recursivamente.

Colocar histórico recuperado dentro da cadeia executável faria o auditor tratar
20 tabelas como se tivessem fonte versionada oficial, e criaria o risco real de
alguém aplicar SQL antigo como se fosse estado desejado.

## Aviso: histórico não é estado desejado

O repositório já tem um exemplo concreto de por que essa distinção importa.

`supabase/migrations/20260720000000_avatars_bucket_rls_policies.sql` é um arquivo
versionado que declara três policies do bucket `avatars`, **nenhuma das quais
verifica o dono do arquivo**. Duas delas — upload e update com apenas
`bucket_id = 'avatars'` — são a forma exata do incidente P1, em que qualquer
usuário autenticado podia sobrescrever o avatar de qualquer outro.

PROD e DEMO estão hoje na forma **segura** (`(storage.foldername(name))[1] =
auth.uid()::text`). O arquivo é uma regressão latente: perigosa apenas se
replayada como se fosse o estado atual.

O estado seguro será estabelecido por **migration nova, forward-only** — sem
editar o histórico já aplicado e sem afrouxar os bancos para coincidir com o
arquivo antigo. Essa correção **não** faz parte desta missão.

A regra geral: **nenhum arquivo histórico recuperado deve ser tratado como
"estado desejado atual"**, aqui ou em `supabase/migrations/`.

## Trust, Trust Graph, Antifraude e Moderação

Algumas destas migrations contêm objetos dessas áreas — notadamente
`20260618050727_etapa_5_5_moderation_antifraude`, além dos tipos e tabelas de
Trust criados em `20260616030900_init_foundation`.

Elas foram **apenas copiadas**. Nenhuma regra foi reinterpretada, nenhum peso
foi alterado, nenhuma semântica foi ajustada, nada foi simplificado ou
executado. Cópia histórica não é mudança de comportamento, e esta missão manteve
essa fronteira literal.

Qualquer consolidação futura dessas áreas deve **representar o estado existente**,
não redesenhá-lo.

## As 18, em ordem cronológica

| # | version | name |
|---|---|---|
| 1 | 20260616030900 | `init_foundation` |
| 2 | 20260616030913 | `enable_extensions` |
| 3 | 20260616030933 | `auth_sync_trigger` |
| 4 | 20260616031020 | `rls_policies` |
| 5 | 20260616031040 | `storage_buckets` |
| 6 | 20260616031222 | `security_hardening` |
| 7 | 20260616031248 | `performance_fixes` |
| 8 | 20260616032149 | `service_request_recurrence_fields` |
| 9 | 20260618032126 | `create_tutor_professional_relationships` |
| 10 | 20260618050727 | `etapa_5_5_moderation_antifraude` |
| 11 | 20260619043458 | `etapa_5_6_badges_verifications` |
| 12 | 20260620142700 | `growth_engine_territory_6_0` |
| 13 | 20260620165906 | `partner_onboarding_activation_6_1` |
| 14 | 20260620173933 | `verification_engine_6_2` |
| 15 | 20260620180520 | `verification_request_pending_unique_6_2` |
| 16 | 20260620193519 | `partner_verification_status_suspended_6_2` |
| 17 | 20260621132824 | `pet_management_foundation_6_3` |
| 18 | 20260621133028 | `pet_is_active_column_rename_6_3` |

## Como verificar a integridade

Recalcule o SHA-256 de cada `.sql` e compare com `file_sha256` no
`manifest.json`. Em `bash`:

```bash
cd supabase/history/recovered
for f in *.sql; do sha256sum "$f"; done
```

Se algum hash divergir, o arquivo foi alterado após a extração — o que não
deveria acontecer, já que este diretório é histórico congelado.
