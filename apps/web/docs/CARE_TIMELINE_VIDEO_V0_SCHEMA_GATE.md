# Care Timeline Video V0 — Gate de Schema

Auditoria read-only concluída. **Vídeo exige migration.** Nada aplicado, nada
commitado. Este documento existe para a DDL ser revisada antes de tocar o banco.

---

## 1. Arquitetura atual (o que reutilizar)

O pipeline de mídia já é sólido e **quase todo reaproveitável**. Cinco etapas:

| # | Etapa | Onde |
|---|---|---|
| 1 | Autorização + emissão de ticket | `care-media-authorization.ts` → `authorizeCareMediaUpload` |
| 2 | Upload **direto** ao Storage pelo browser | `upload-care-media-client.ts` |
| 3 | Validação por magic bytes na publicação | `actions.ts` → `validateMediaPaths` |
| 4 | Inserção atômica | `repository.ts` → `createCareUpdateAtomic` |
| 5 | Leitura por signed URL | `authorizeCareMediaRead(careMediaId)` |

**Invariantes que já estão certos e valem igual para vídeo:**

- **Path gerado no servidor**, nunca aceito do cliente:
  `requests/<requestId>/<uuid>.<ext>`. Remove a classe inteira de "anexar mídia
  de outro atendimento".
- **Upload direto é obrigatório**, não preferência: Server Actions têm
  `bodySizeLimit: 6mb`. Um vídeo de 50 MB nunca poderia passar por action.
- **Uma única porta de inserção** em `care_media` — `createCareUpdateAtomic`,
  aceitando só `ValidatedCareMedia[]`. O schema documenta que essa é a razão de
  não existir coluna `validatedAt`.
- **Nenhuma URL pública.** `getPublicUrl()` não é chamado em lugar nenhum.
  Leitura sempre por signed URL de 1 h, emitida depois de 5 elos provados.
- **Reprovado é apagado** do bucket dentro do próprio `validateMediaPaths`.

**Autorização de escrita** (3 camadas, todas do banco, nenhuma do cliente):
sessão + persona profissional → é o profissional *desta* request →
`IN_PROGRESS` e sem disputa aberta.

**Autorização de leitura**: tutor **e** profissional, via `careMediaId` (nunca
path), com soft-delete do CareUpdate respeitado.

Conclusão: **não há arquitetura paralela a criar.** Vídeo entra como um segundo
`CareMediaType` no mesmo caminho.

---

## 2. Por que exige migration — três frentes

### (a) Enum `CareMediaType` — bloqueia tudo

```prisma
enum CareMediaType {
  PHOTO
}
```

Confirmado no banco: um único valor, `PHOTO`. O schema traz um comentário
explícito de que a ausência é deliberada:

> *"V0 aceita apenas foto. VIDEO não existe aqui de propósito: um valor de enum
> sem pipeline de validação, transcodificação e limite de duração seria uma
> promessa que o código não cumpre."*

Esta missão constrói justamente essa fundação — então o valor passa a ser
honesto. Mas é DDL.

### (b) Configuração do bucket `care-media`

Estado real medido:

| Campo | Valor atual | Necessário para vídeo |
|---|---|---|
| `public` | `false` | mantém `false` |
| `file_size_limit` | `5242880` (5 MB) | `52428800` (50 MB) |
| `allowed_mime_types` | `[image/jpeg, image/png, image/webp]` | + tipos de vídeo |

### (c) Coluna de duração — **opcional, e eu recomendo NÃO criar**

Ver seção 4.

---

## 3. DDL proposta

```sql
-- (a) Novo valor de enum.
--
-- ATENÇÃO OPERACIONAL: em PostgreSQL (aqui: 17.6) `ALTER TYPE ... ADD VALUE`
-- pode rodar dentro de transação, MAS o valor novo não pode ser USADO na mesma
-- transação. O procedimento padrão deste projeto aplica DDL num bloco
-- transacional único — então este comando precisa ir SOZINHO, num passo
-- próprio, antes de qualquer coisa que referencie 'VIDEO'.
--
-- IF NOT EXISTS torna o passo idempotente (re-execução segura).
ALTER TYPE "CareMediaType" ADD VALUE IF NOT EXISTS 'VIDEO';
```

```sql
-- (b) Bucket: teto de tamanho e tipos aceitos.
--
-- Os tipos escolhidos cobrem o que Android e iOS realmente produzem:
--   video/mp4        — Android Chrome, e o container de saída do iOS
--   video/quicktime  — .mov nativo do iPhone
-- Ambos são ISOBMFF (mesma estrutura de caixa 'ftyp' que o detector atual já
-- lê para reconhecer HEIC), o que torna a validação por magic bytes viável
-- reaproveitando o mecanismo existente.
--
-- webm NÃO entra no V0: Safari não grava webm, e aceitar um formato que metade
-- dos aparelhos não reproduz nativamente criaria mídia impossível de assistir
-- para o tutor.
UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime'
  ]
WHERE id = 'care-media';
```

**Diff de schema Prisma** (só o enum muda):

```diff
 enum CareMediaType {
   PHOTO
+  VIDEO
 }
```

`model CareMedia` **não muda** — `type`, `storagePath`, `mimeType`, `sizeBytes`
já servem vídeo sem alteração.

---

## 4. Três decisões que precisam de você

### 🔴 Decisão 1 — O teto de 50 MB enfraquece o freio de custo das fotos

`file_size_limit` é **por bucket**, não por tipo. Subindo para 50 MB, uma
*foto* de 50 MB também passa a ser aceita **no upload**.

Ela seria rejeitada na publicação (`validateCareMediaContent` compara contra
`CARE_MEDIA_MAX_BYTES` = 5 MB) e o objeto é apagado ali mesmo — mas até lá ela
ocupou o bucket, e se a publicação nunca acontecer, vira órfã de 50 MB em vez
de 5 MB. O freio de custo existente
(`CARE_MEDIA_MAX_OBJECTS_PER_REQUEST = 60`) passa a autorizar até 3 GB por
request em vez de 300 MB.

Opções:

| # | Opção | Custo |
|---|---|---|
| **A** | Aceitar. Manter 1 bucket, teto 50 MB, e **baixar** o freio de objetos (ex.: 60 → 25) | Simples. Reduz margem de retentativa num atendimento longo |
| **B** | Bucket separado `care-video` com teto próprio | Mantém foto protegida em 5 MB, mas é a "arquitetura paralela de mídia" que a missão pede para evitar |
| **C** | Aceitar sem mexer no freio | Mais simples de todas; risco de custo real se alguém abusar |

**Minha recomendação: A.** Mantém um caminho só (o que a missão pede), e o
ajuste do freio compensa o teto maior. B viola a restrição explícita da missão;
C deixa um buraco de custo sem contrapartida.

### 🔴 Decisão 2 — O limite de 60s **não é aplicável no servidor** de forma robusta

Preciso ser direto: **não consigo garantir 60s server-side em V0** sem parsear
o container MP4/MOV (ler a caixa `moov`/`mvhd` para extrair `duration` e
`timescale`). Isso é trabalho real, e um arquivo malformado de propósito pode
mentir na caixa.

O que dá para fazer, honestamente:

- **Cliente**: ler `videoElement.duration` após carregar metadata e recusar
  acima de 60s antes de subir. É UX boa e cobre 100% do uso legítimo.
- **Servidor**: o limite que **realmente** vale é o de **tamanho** (50 MB).
  Ele é medido do objeto real, não declarado.

Ou seja: 60s é um limite de **produto**, aplicado no cliente; 50 MB é o limite
de **segurança/custo**, aplicado no servidor. Não vou escrever "valida duração"
num lugar onde isso não é verdade.

**Consequência:** um vídeo de 3 minutos muito comprimido (< 50 MB) passaria se
alguém contornasse o cliente. Aceito no V0? Se não for, a alternativa é parsear
`mvhd` — dá para fazer, mas é escopo adicional e eu preferiria medir antes.

**Não proponho coluna `durationSeconds`**: ela só poderia ser preenchida com o
valor que o cliente informou, e uma coluna que parece verificada mas não é
repete exatamente o erro que o comentário do schema diz ter evitado com
`validatedAt`.

### 🟡 Decisão 3 — Poster/thumbnail

A transformação de imagem do Supabase Storage **não funciona em vídeo** — não
há como derivar poster no servidor sem ffmpeg/serviço de transcodificação
(explicitamente fora de escopo).

Alternativa sem infraestrutura: capturar um frame no **cliente** (desenhar o
`<video>` num `<canvas>` após `seeked`) e subir como uma segunda mídia. Custa
um upload extra e uma linha extra por vídeo.

**Recomendação: ficar sem poster no V0.** `preload="metadata"` já faz o browser
mostrar o primeiro frame na maioria dos casos, e a missão coloca poster como
"somente se puder ser implementado sem infraestrutura pesada". Se sobrar
janela, entra depois — que é exatamente a ordem que você indicou.

---

## 5. O que já mapeei para implementar (depois do gate)

Sem surpresas, tudo dentro dos arquivos existentes:

| Arquivo | Mudança |
|---|---|
| `lib/storage/care-media-path.ts` | extensões `mp4`/`mov`, tipo `CareMediaKind`, teto de vídeo separado do de foto |
| `lib/storage/pet-photo-signature.ts` *(ou novo detector irmão)* | reconhecer `ftyp` de MP4/QuickTime — o parser de caixa ISOBMFF **já existe** ali para HEIC |
| `lib/storage/care-media-validation.ts` | ramo de vídeo, com teto próprio |
| `care-media-authorization.ts` | aceitar mime de vídeo na allowlist da porta |
| `actions.ts` → `validateMediaPaths` | derivar `type` (PHOTO/VIDEO) e gravar |
| `repository.ts` | `ValidatedCareMedia` ganha `type` |
| `domain/photo-selection.ts` | regra "1 vídeo **ou** até 3 fotos", duração no cliente |
| `CarePhotoPicker.tsx` | `accept="video/*"` + `capture` progressivo |
| `CareMediaGallery.tsx` | `<video controls preload="metadata">`, sem autoplay, fallback |

**Push não muda**: vídeo é um `CareUpdate` como outro qualquer e cai no mesmo
`care_update` com cooldown de 1 h. Nenhum evento novo.

---

## 6. Mobile — o que dá para prometer

Auditei `camera-capture.ts`, que já resolveu esse problema para foto (com um
incidente real documentado: `pointer: coarse` falhava em Android com S-Pen).
A mesma detecção (`any-pointer: coarse` **ou** `maxTouchPoints > 0`) serve
para vídeo.

Honestamente, sobre `capture="user"`/`capture="environment"` com
`accept="video/*"`:

- **Android Chrome**: normalmente abre a câmera em modo vídeo. Confiável.
- **iOS Safari**: o comportamento varia por versão; frequentemente abre a
  bandeja de opções (Câmera / Fototeca / Arquivos) em vez da câmera direto.
- **Desktop**: `capture` é ignorado, abre seletor de arquivos.

Por isso a abordagem é **progressiva**: um botão "Gravar vídeo" com `capture` e
um "Escolher da galeria" sem — exatamente o padrão de dois botões que o
componente de foto já usa. Não vou prometer que todo SO abre a câmera direto.

---

## Aguardando

1. **Decisão 1** — teto do bucket e freio de objetos (recomendo **A**)
2. **Decisão 2** — aceitar 60s só no cliente, ou investir em parse de `mvhd`
3. **Decisão 3** — poster fora do V0 (recomendo sim)
4. **Aprovação da DDL** das seções 3(a) e 3(b)

Com isso aprovado, implemento na ordem: path/detector → validação → autorização
→ publicação → player → QA.

*Nada aplicado ao banco. Nada commitado. Nada pushado.*
