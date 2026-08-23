# Care Timeline Video V0 — Gate de DDL (A–I)

Decisões aprovadas incorporadas: dois buckets, `care-media` intocado, sem
`durationSeconds`, 60s como regra de cliente, sem poster.

**Nada aplicado ao banco. Nada commitado.**

---

## A. Diff exato do enum

`apps/web/prisma/schema.prisma`:

```diff
-/// V0 aceita apenas foto. VIDEO não existe aqui de propósito: um valor de enum
-/// sem pipeline de validação, transcodificação e limite de duração seria uma
-/// promessa que o código não cumpre. Entra quando houver a fundação, não antes.
+/// PHOTO e VIDEO compartilham a MESMA tabela e o MESMO pipeline lógico
+/// (autorização → ticket → upload direto → magic bytes → publicação atômica →
+/// signed URL). O que muda por tipo é apenas o BUCKET físico de destino e o
+/// teto de tamanho — ver bucketForCareMediaKind.
+///
+/// VIDEO entrou quando a fundação passou a existir: detecção de container
+/// ISOBMFF por magic bytes, teto de 50 MB verificado no objeto real e bucket
+/// privado próprio. O que NÃO existe, e por isso não é prometido em lugar
+/// nenhum: garantia server-side de DURAÇÃO. Os 60s são regra de produto
+/// aplicada no cliente; o servidor garante tamanho, container e posse.
 enum CareMediaType {
   PHOTO
+  VIDEO
 }
```

`model CareMedia` **não muda**. `type`, `storagePath`, `mimeType`, `sizeBytes`
já comportam vídeo.

---

## B. SQL / migration

### Passo 1 — enum

```sql
ALTER TYPE "CareMediaType" ADD VALUE IF NOT EXISTS 'VIDEO';
```

**Nota operacional (PostgreSQL 17.6, verificado):** desde o PG 12 este comando
*pode* rodar dentro de bloco transacional — o que não pode é **usar** o valor
novo na mesma transação. Como este passo apenas adiciona (nenhum `INSERT` com
`'VIDEO'` acompanha), rodar dentro da transação é seguro. Ainda assim recomendo
executá-lo **sozinho**, antes do passo 2, para que um erro no bucket não deixe
dúvida sobre o estado do enum.

### Passo 2 — bucket novo

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'care-media-video',
  'care-media-video',
  false,
  52428800,
  ARRAY['video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;
```

`ON CONFLICT DO NOTHING` torna o passo idempotente e **impede** que uma
re-execução sobrescreva configuração de um bucket já existente.

### Verificação pós-aplicação

```sql
-- Espera-se exatamente: care-media 5242880 (3 mime de imagem)
--                      care-media-video 52428800 (2 mime de vídeo)
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id LIKE 'care-media%' ORDER BY id;

-- Espera-se: PHOTO, VIDEO
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'CareMediaType' ORDER BY e.enumsortorder;

-- Espera-se ZERO linhas (ver seção F).
SELECT policyname FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND (qual LIKE '%care-media%' OR with_check LIKE '%care-media%');
```

---

## C. Definição do bucket `care-media-video`

| Campo | Valor | Por quê |
|---|---|---|
| `id` / `name` | `care-media-video` | |
| `public` | **`false`** | Mesmo modelo do `care-media`. `getPublicUrl()` não é chamado em lugar nenhum do código e não passa a ser |
| `file_size_limit` | `52428800` (50 MB) | Teto do V0 |
| `allowed_mime_types` | `video/mp4`, `video/quicktime` | Ver E |

---

## D. `file_size_limit`

**50 MB (52.428.800 bytes)** — só neste bucket.

O limite do bucket é a **primeira** barreira (o Storage recusa acima disso). A
que vale é a **segunda**: `validateCareMediaContent` compara contra o tamanho
real do objeto baixado, na publicação. Um vídeo que passe pelo bucket mas
exceda o teto de aplicação é rejeitado e **apagado**, como já acontece com foto.

Os dois números precisam ficar iguais — divergir faria a app aceitar o que o
bucket recusa (ou o contrário). Constante nova: `CARE_MEDIA_VIDEO_MAX_BYTES`.

---

## E. MIME allowlist

`video/mp4` · `video/quicktime`

- Os dois são **ISOBMFF** — mesma estrutura de caixa `ftyp` que o detector
  atual já lê para reconhecer e **recusar** HEIC. A detecção por magic bytes
  reaproveita o mecanismo existente em vez de criar um segundo.
- `video/quicktime` (`.mov`) é o que o iPhone grava nativamente.
- **`webm` fica de fora**: Safari não grava nem reproduz de forma confiável.
  Aceitar produziria vídeo que metade dos tutores não conseguiria assistir.

---

## F. Policies / RLS — **a descoberta mais importante deste gate**

Auditei `pg_policies` no schema `storage`. Resultado:

> **`care-media` não tem NENHUMA policy.** Zero. Existem 10 policies em
> `storage.objects` — todas para `avatars`, `documents` e `pets`. Nenhuma
> menciona `care-media`.

E `storage.objects` tem **RLS habilitado** (`relrowsecurity = true`).

Isso não é um esquecimento — **é o modelo de segurança**. Com RLS ativo e
nenhuma policy concedendo acesso, o Postgres **nega por padrão**: nenhum
usuário `anon` ou `authenticated` consegue ler, escrever ou listar objetos do
bucket. O único acesso é via **service role**, que ignora RLS — exatamente o
que `createCareMediaStorageClient()` usa, e por isso aquele arquivo é
`server-only` e monta o cliente **sem cookies** (há um comentário longo lá
explicando que, com cookies, o JWT do usuário venceria a service key).

### Consequência: `care-media-video` também deve ter ZERO policies

**Nenhuma policy será criada.** Criar qualquer uma seria uma regressão de
segurança — abriria um caminho de acesso direto que hoje não existe para
`care-media`, contornando as três camadas de autorização de domínio.

O acesso do browser acontece só por **capability de vida curta**:
- escrita: signed upload URL emitida após autorização completa;
- leitura: signed read URL (1 h) emitida após os 5 elos de
  `authorizeCareMediaRead`.

A query de verificação da seção B confirma que o resultado esperado é
**zero linhas**.

---

## G. Mudanças necessárias nos helpers

### G.1 — Seleção de bucket por tipo (fonte única)

`modules/care-timeline/domain/care-media-bucket.ts` hoje exporta uma string.
Passa a exportar também a resolução por tipo — continua sendo o **único** lugar
onde os nomes existem, compartilhado por servidor e browser:

```ts
export const CARE_MEDIA_BUCKET_NAME = "care-media"
export const CARE_MEDIA_VIDEO_BUCKET_NAME = "care-media-video"

export type CareMediaKind = "PHOTO" | "VIDEO"

export function bucketForCareMediaKind(kind: CareMediaKind): string {
  return kind === "VIDEO" ? CARE_MEDIA_VIDEO_BUCKET_NAME : CARE_MEDIA_BUCKET_NAME
}
```

### G.2 — `lib/storage/care-media.ts` (server-only)

Toda função que hoje faz `.from(CARE_MEDIA_BUCKET)` passa a receber o `kind`:

| Função | Mudança |
|---|---|
| `createCareMediaUploadTicket` | bucket por kind |
| `createCareMediaReadUrl` | bucket por kind |
| `readCareMediaForValidation` | bucket por kind + **ver G.4** |
| `deleteCareMediaObject` | bucket por kind |
| `countCareMediaObjectsForRequest` | passa a somar os **dois** buckets (o freio de custo é por request, não por bucket) |
| `createCareMediaThumbnailUrl` / `createCareMediaDisplayUrl` | **recusam VIDEO explicitamente** — a transformação do Storage só opera em imagem; chamar com vídeo devolveria URL quebrada |

### G.3 — `upload-care-media-client.ts` (browser)

Recebe o `kind` (ou o nome do bucket já resolvido) junto do ticket. O
`Blob` continua sendo reconstruído com o MIME **autorizado pelo servidor**,
nunca `file.type` — a lição documentada ali (mobile manda `file.type` vazio e o
multipart declara `application/octet-stream`) vale igual para vídeo, e
provavelmente mais.

### G.4 — 🔴 Custo de validação: `download()` de 50 MB para ler 12 bytes

`readCareMediaForValidation` faz `.download(path)` — **baixa o objeto inteiro**
para ler o header. O comentário existente reconhece o custo e o aceita para
fotos de 5 MB:

> *"CUSTO CONHECIDO: `download()` traz o objeto INTEIRO (até 5 MB) para ler 12
> bytes de assinatura. […] Aceito no V0 […]; otimizável depois com
> `Range: bytes=0-11` sobre URL assinada."*

Para vídeo isso vira **até 50 MB baixados por publicação**, dentro do fluxo de
publicar — 10× o custo e 10× a latência, num caminho que o profissional espera
em pé, durante um atendimento.

**Proponho implementar o `Range` para vídeo** (a otimização que o próprio
comentário já previa): emitir signed URL de leitura e fazer `fetch` com
`Range: bytes=0-11`. O `Content-Range` da resposta devolve o **tamanho total**
no formato `bytes 0-11/<total>` — que é exatamente o `sizeBytes` autoritativo
de que precisamos, sem baixar o arquivo.

Foto continua no caminho atual (`download`), inalterada. Se o `Range` falhar
por qualquer motivo, cai no `download` como fallback.

### G.5 — Demais arquivos (sem DDL)

`care-media-path.ts` (extensões `mp4`/`mov`, tetos por kind) ·
detector ISOBMFF de vídeo · `care-media-validation.ts` (ramo de vídeo) ·
`care-media-authorization.ts` (allowlist + kind) · `actions.ts`
(`validateMediaPaths` deriva `type`) · `repository.ts` (`ValidatedCareMedia`
ganha `type`) · regras de seleção · picker · gallery.

---

## H. Garantia de que foto continua em 5 MB

O passo 2 é um **`INSERT`** de um bucket novo. Não há `UPDATE` em
`storage.buckets` em nenhum ponto desta migration — `care-media` não é tocado
por nenhum comando.

Três travas independentes:

1. **A DDL não contém `UPDATE`.** Só `ALTER TYPE` e `INSERT ... ON CONFLICT DO NOTHING`.
2. **`CARE_MEDIA_MAX_BYTES` permanece `5 * 1024 * 1024`** em
   `care-media-path.ts`. O teto de vídeo é uma constante **nova e separada**,
   nunca uma alteração da existente.
3. **Verificação explícita** na query da seção B: `care-media` deve continuar
   `5242880` com os 3 MIME de imagem.

Efeito colateral positivo do bucket separado: um vídeo **não pode** ser gravado
no bucket de fotos nem o contrário — o `allowed_mime_types` de cada um recusa
na origem, independentemente de qualquer bug de aplicação.

---

## I. Rollback

### Bucket — reversível

```sql
-- Só se estiver vazio. Não force: um DELETE com objetos dentro deixa
-- registros órfãos em storage.objects.
DELETE FROM storage.buckets WHERE id = 'care-media-video';
```

Se já houver objetos, apagá-los primeiro (ou manter o bucket, que sem uso não
custa nada além do armazenado).

### Enum — 🔴 **NÃO é reversível de forma barata**

Preciso ser explícito: **PostgreSQL não tem `ALTER TYPE ... DROP VALUE`.**
Remover `'VIDEO'` exigiria recriar o tipo inteiro:

```sql
-- NÃO recomendado. Registrado só para o rollback ser honesto.
-- Exige: criar tipo novo, dropar default da coluna, ALTER COLUMN ... USING,
-- recriar default, dropar tipo antigo. Tudo numa tabela viva.
```

**Portanto: adicionar `'VIDEO'` ao enum é uma porta de mão única na prática.**

O que torna isso aceitável: um valor de enum **sem nenhuma linha referenciando**
é inerte — não afeta consultas, índices, performance nem o Prisma Client. O
rollback real do produto é parar de **emitir** `VIDEO` (reverter o código),
não remover o valor do banco.

Rollback de código é `git revert` normal — nenhuma coluna nova, nenhum dado
migrado, nenhuma linha existente alterada.

### Resumo de reversibilidade

| Item | Reversível? |
|---|---|
| `care-media` (bucket de fotos) | **não é tocado** |
| Linhas existentes de `care_media` | **não são tocadas** |
| Bucket `care-media-video` | sim (DELETE) |
| Valor `'VIDEO'` no enum | **não, na prática** — mas inerte sem uso |
| Código | sim (`git revert`) |

---

## Resumo do gate

| Critério | Situação |
|---|---|
| Aditivo? | ✅ `ADD VALUE` + `INSERT`. Zero `UPDATE`, zero `DROP`, zero alteração de linha existente |
| Seguro? | ✅ Bucket privado sem policies (deny-by-default, espelhando `care-media`) |
| Foto protegida? | ✅ `care-media` intocado — 5 MB preservados, verificável |
| Reversível? | ⚠️ Bucket sim; valor de enum não (inerte sem uso) |

**Aguardando aprovação explícita para executar os passos 1 e 2.**

*Nada aplicado. Nada commitado. Nada pushado.*
