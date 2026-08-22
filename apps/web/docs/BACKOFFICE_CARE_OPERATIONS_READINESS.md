# Pré-Piloto — Backoffice Care Operations Readiness

Auditoria + implementação. **Nada commitado. Nada pushado. Nenhuma migration.**

Restrições respeitadas: nenhum CRM, nenhum billing, Trust/Ranking intocados,
state machine intocada, contrato de Push intocado, nenhum analytics externo.

---

## A. Arquitetura antes

O backoffice **não era um esqueleto** — já tinha 27 rotas, shell próprio,
componentes compartilhados (`AdminDataTable`, `AdminStatusBadge`,
`AdminPageHeader`) e um módulo `backoffice` com camadas separadas
(`domain` / `application` / `infrastructure`, ~1.500 linhas).

O padrão é consistente: página Server Component → action com `assertAdmin()` →
repositório Prisma com `take` explícito. Isso significou que a missão foi
majoritariamente **preencher buracos**, não reconstruir.

## B. Rotas admin (antes)

`/admin` · `users` · `tutors` · `professionals` · `requests` ·
`requests/[requestId]` · `reviews` · `trust` · `relationships` · `growth` ·
`invites` · `verifications` · `badges` · `partners` · `partners/[id]` ·
`recommendations` · `trust-graph` · `flags` · `disputes` · `notifications` ·
`activity` · `audit` · `risk` · `moderacao` · `antifraude` · `rede` ·
`dev-tools` (só em development).

Fora do grupo: `/admin/trust-debug/[professionalId]`, `/admin/trust-recalculate`.

## C. Gaps encontrados

| # | Gap | Evidência | Classe |
|---|---|---|---|
| 1 | **Push sem nenhuma superfície admin** | `grep PushDelivery/PushSubscription` em todo o backoffice: **zero ocorrências**, com 68 entregas e 19 inscrições no banco | **P1** |
| 2 | **`EXPIRED` impossível de filtrar** | badge sabia desenhar, filtro não oferecia. **9 requests EXPIRED** no banco, invisíveis a qualquer recorte | **P1** |
| 3 | **Sem timeline operacional** | reconstruir incidente exigia 5 superfícies + banco na mão | **P1** |
| 4 | **Zero `loading.tsx` / `error.tsx`** em todo o `/admin` | navegação congelava na tela anterior; exceção dava tela em branco | **P1** |
| 5 | **Erro indistinguível de vazio** | `getAdminFlags` e `getAdminDisputes` faziam `catch { return [] }` | **P1** |
| 6 | `startedAt` ausente da lista de requests | não dava para separar "aceito mas nunca começou" de "aconteceu" | **P2** |
| 7 | Sem filtro de período nem busca por id | triagem partia sempre de 300 linhas | **P2** |
| 8 | `OperationalFlag` sem uso real | 1 escritor (moderação), **0 linhas** | **P3** |

## D. Request operations

`/admin/requests`:

- **`EXPIRED` no filtro** — o gap mais barato e mais material: 9 solicitações
  reais estavam fora de alcance.
- **Filtro de período** — Hoje / 7 dias / 30 dias, aplicado no `where` (não em
  memória depois do `take`, que devolveria resultado errado assim que a base
  passar de 300).
- **Busca por id** — `startsWith`, porque a tela exibe os 8 primeiros
  caracteres e é esse prefixo que alguém copia de um relato. Com `.trim()`:
  colar um id costuma trazer espaço junto, e um espaço invisível faria a busca
  não achar nada sem explicar o porquê.
- **Coluna `startedAt`**.
- Empty state distingue "nenhuma solicitação" de "nenhuma para estes filtros".

**Read-only.** Nenhuma mutation administrativa foi adicionada.

## E. Timeline operacional

`modules/backoffice/domain/request-timeline.ts` — função pura, 20 testes.

Funde cinco fontes numa sequência ordenada: ciclo de vida da Request, Diário,
entregas de push, auditoria e disputas.

Duas decisões que o teste trava:

**Desempate por causalidade.** Request criada e push despachado acontecem na
mesma Server Action, no mesmo segundo. Sem ordem estável, a leitura sugeriria
que o aviso saiu antes do fato que o originou — a conclusão errada numa
investigação. `ServiceRequest → CareUpdate → Dispute → AuditLog → PushDelivery`.

**`COMPLETED` não duplica.** Terminais sem carimbo próprio (cancelamento,
expiração) são reconstruídos de `updatedAt`, mas `COMPLETED` usa `completedAt` —
`updatedAt` se move depois (uma avaliação posterior), o que criaria uma segunda
linha de conclusão em horário errado. E o rótulo de terminal aproximado **diz
que é aproximado**, para ninguém tratar o horário como exato numa disputa.

## F. Care Timeline / mídia

Entra na timeline como **marcador**, nunca conteúdo: horário, categoria, autor,
contagem de mídia, `occurredAt` quando diverge de `createdAt`, e sinalização de
editada/excluída.

`CareUpdate.content` **não é lido** pelo repositório da timeline. Não é só
privacidade (embora seja: Diário pode ter saúde, medicação, rotina da casa) —
despejar o texto ali transformaria o log de incidente num segundo Diário pior
que o original. O conteúdo continua na `AdminCareTimelineInspection`, que já
existia, logo abaixo na mesma página.

Mídia entra como **contagem via `_count`**, no mesmo round-trip. Carregar
`CareMedia` numa lista significaria assinar URLs que ninguém vai abrir. Bucket
não foi tocado.

## G. Push observability

`/admin/push` — novo. Classificação em `push-observability.ts` (função pura, 16
testes).

Seis desfechos observáveis: `ACCEPTED_BY_PROVIDER`, `NO_ELIGIBLE_DEVICE`,
`CONFIGURATION_FAILURE`, `TRANSIENT_FAILURE`, `PERMANENT_FAILURE`,
`UNCLASSIFIED_FAILURE`.

**Ordem de precedência: configuração primeiro.** É a única classe que exige
alguém DA EQUIPE agir; as outras descrevem o mundo. Numa entrega em que um
aparelho tomou 403 e outro foi aceito, o que precisa aparecer na triagem é o
403 — e a flag `parcial` preserva que alguém recebeu, porque `outcome` sozinho
mentiria nos dois sentidos.

**`attempted = 0` é `NO_ELIGIBLE_DEVICE`, nunca falha** — contrato explícito do
dispatcher, mantido aqui.

**Linhas legadas viram `UNCLASSIFIED_FAILURE`**, não uma classe chutada. Inventar
uma produziria telemetria falsa sobre o passado.

**Supressão por anti-spam não aparece — e está certo.** O cooldown de
`care_update` vive dentro do eventKey: o segundo update da mesma hora colide no
unique e **não cria linha**. Não há registro a exibir, e inventar um o
transformaria numa falha aos olhos de quem tria. Documentado na própria página.

**Vocabulário travado por teste.** Nenhum rótulo pode afirmar que alguém
recebeu ou viu. O teste separa afirmação de negação — o aviso correto ("não é
prova de que o aparelho exibiu") contém justamente o vocabulário proibido, e
proibi-lo cru puniria o texto que faz a coisa certa. Há teste do próprio teste,
para o filtro de negação não ser afrouxado até não pegar mais nada.

A página traz aviso permanente: **aceito pelo provedor ≠ exibido no aparelho**.

## H. Subscription health

Por usuário: ativas/revogadas, `revokedReason` com rótulo humano, `lastSeenAt`,
ambiente e fingerprint resumido.

`lastSeenAt` é rotulado **"Revalidada"**, com nota explícita de que não é prova
de entrega — a semântica fixada na missão anterior.

## I. Disputes

Auditada. A tela existe e funciona; mostra request, partes, motivo, descrição,
status e timestamps, com `UpdateDisputeButton` para resolução manual (nenhuma
automática foi criada).

**A correlação que faltava foi resolvida pela timeline**: abertura e
encerramento de disputa agora aparecem em `/admin/requests/[id]` junto do
Diário, dos pushes e da auditoria daquele atendimento.

Corrigido: `getAdminDisputes` engolia exceção e devolvia `[]`.

## J. Expired / Cancelled

- `EXPIRED` filtrável (9 registros reais destravados).
- Cancelamento distingue tutor de profissional, na lista e na timeline.
- Ambos aparecem na timeline com ponto de atenção e aviso de instante
  aproximado.
- O push correspondente (ou sua ausência) aparece na mesma sequência.

## K. Invites

`/admin/invites` **já estava** na navegação (grupo Expansão) e já mostra visitas
únicas, cadastros, pets, solicitações, concluídos e conversão por profissional,
sem `visitorKey` e sem `convertedUserId`. Verificado, nada a fazer.

## L. Flags

`OperationalFlag` tem **1 escritor** (`modules/moderation`) e **0 linhas**. O
mecanismo existe mas nunca foi exercido.

**Nenhuma engine nova foi criada** — a instrução era clara. Os sinais que a
missão listaria como flags já estão visíveis onde importam: disputa aberta e
falha de push aparecem como ponto de atenção na timeline da própria Request, e
falha de configuração tem contador próprio em `/admin/push`.

Classificado **P3**: ligar a engine de flags é decisão de produto, não lacuna de
observabilidade.

## M. Autorização

Toda action nova chama `requireAdminOrRedirect()` **antes** de qualquer leitura,
sem depender do guard do `AdminShell` — Server Actions são endpoints de verdade,
e um layout que protege a página não protege a action.

**Verificado ao vivo**, não só por leitura: dev server real, navegação para
`/admin/push` sem sessão →

```
GET /login?next=%2Fadmin%2Fpush 200
```

Nenhuma query nova confia em parâmetro do cliente para escopo. O admin lê a
plataforma inteira por definição do papel; não há escopo a forjar. Teste
estrutural garante que o guard precede a primeira leitura.

## N. PII / segredos

**Nunca exibidos:** `endpoint`, `p256dh`, `auth` (os três juntos permitem ENVIAR
push para o aparelho de alguém — um backoffice que os mostrasse transformaria
uma captura de tela numa credencial de envio). Teste estrutural varre o
repositório e falha se algum `select` os incluir.

**Mascarados:** `endpointHash` → 12 chars (suficiente para correlacionar o mesmo
aparelho, sem publicar o hash inteiro); `vapidKeyFingerprint` → 8 chars (deriva
de chave pública, não é segredo, mas não há motivo para o hash completo).

**Não lidos pela timeline:** `AuditLog.ipAddress`, `userAgent`, `before`,
`after` (payloads JSON arbitrários que podem conter qualquer campo, inclusive
PII sem relação), `CareUpdate.content`.

Achado positivo da auditoria: `/admin/audit` **já não expunha** IP nem
userAgent. Nada a corrigir ali.

## O. Performance

- Todo `findMany` novo tem `take` explícito (200 entregas, 200 inscrições, 100
  audit, 100 care) — teste estrutural conta `findMany` vs `take`.
- Mídia por `_count` no mesmo round-trip, nunca uma query por atualização.
- `AuditLog` filtrado por `entityId` no banco, nunca carregado inteiro para
  filtrar em memória.
- Leituras independentes em `Promise.all` — 4 na página de push, 3 no detalhe
  da request, 4 counts no overview.
- Recorte temporal no `where`, não depois do `take`.

## P. Testes

`npm run test:backoffice` → **36 passando, 0 falhando** (novo script).

Cobertura: admin autorizado (trava estrutural), classificação das 6 leituras de
push, entrega parcial, linha legada, dado sem segredo (trava estrutural),
vocabulário que não afirma entrega, mascaramento, disputa, expired/cancelled,
ordem causal, Care Timeline sem conteúdo, atenção, vazio, `take` obrigatório.

### Bateria de regressão

| Comando | Resultado |
|---|---|
| `test:backoffice` | ✅ 36 / 0 |
| `test:push` | ✅ 194 / 0 |
| `test:notification-read` | ✅ 42 / 0 |
| `test:invite` | ✅ 36 / 0 |
| `test:active-request-sync` | ✅ 52 / 0 |
| `test:request-expiry` | ✅ 30 / 0 |
| `test:care-media` | ✅ 168 / 0 |
| `test:trust-scoring` | ✅ 15 / 0 |
| `test:relationship` | ✅ 39 / 0 |
| `typecheck` | ✅ limpo |
| `lint` | ✅ **0 erros** (22 warnings, o mesmo número de antes, em arquivos não tocados) |
| `build` | ✅ compilou, `/admin/push` registrada |
| `check-sensitive-data` | ✅ 0 críticos (6 suspeitos pré-existentes em scripts de seed) |
| varredura manual dos untracked | ✅ 0 ocorrências em 13 arquivos |
| `git diff --check` | ✅ limpo |

## Q. Riscos

1. **Nenhuma tela nova foi vista renderizada.** O guard foi verificado ao vivo,
   mas a inspeção visual de `/admin/push` e da timeline exige sessão ADMIN, que
   eu não tenho. Contas admin no banco: `admin.demo@peteen.app` e
   `vitor.moliveria@gmail.com`. **É o principal risco residual.**
2. **`erro ≠ vazio` só vale para o que sobe.** Removi o `catch { return [] }` de
   flags e disputas, mas outras funções do repositório ainda silenciam
   (`getDashboardMetrics`, `getAdminRiskData`). Ficaram fora por não serem
   superfície de investigação de atendimento — **P2**.
3. **`UNCLASSIFIED_FAILURE` vai dominar no começo.** Todas as 68 entregas atuais
   são anteriores ao diagnóstico estruturado. A tela ficará honesta, mas pouco
   informativa até acumularem entregas novas.
4. **`take` sem paginação.** 200/300 linhas é teto, não página. Suficiente para
   o piloto; vira limitação real quando a base crescer — **P2**.
5. **Timeline depende de `AuditLog.entityId`.** Eventos registrados com outro
   `entityId` (ex.: id da disputa em vez do da request) não aparecem. As
   disputas são lidas direto da tabela, então o caso principal está coberto.
6. **`OperationalFlag` continua morto.** Deliberado — **P3**.

---

## Classificação consolidada

| Achado | Classe | Estado |
|---|---|---|
| Push sem superfície admin | P1 | ✅ resolvido |
| `EXPIRED` não filtrável | P1 | ✅ resolvido |
| Sem timeline operacional | P1 | ✅ resolvido |
| Sem loading/error no admin | P1 | ✅ resolvido |
| Erro indistinguível de vazio (flags/disputas) | P1 | ✅ resolvido |
| `startedAt` ausente | P2 | ✅ resolvido |
| Filtros de período e id | P2 | ✅ resolvido |
| Silenciamento em dashboard/risk | P2 | ⬜ reportado |
| Paginação real | P2 | ⬜ reportado |
| `OperationalFlag` sem uso | P3 | ⬜ deliberado |

**Nenhum P0.** Nenhuma falha de autorização, nenhum vazamento de segredo,
nenhuma exposição de PII encontrada na auditoria — o backoffice existente já
estava correto nesses eixos.

---

## Veredito

# 🟢 BACKOFFICE CARE OPERATIONS = APTO PARA QA ADMIN

Sem migration. Schema intocado. Todos os P1 fechados, com testes.

**Ressalva honesta:** "apto para QA admin" é exatamente o que está sendo
afirmado — nenhuma das telas novas foi vista renderizada, porque isso exige uma
sessão ADMIN que eu não tenho. O QA precisa entrar como
`admin.demo@peteen.app` (ou sua própria conta, que também é admin) e conferir:

1. `/admin/push` — cartões, tabela, badges, filtros de período/evento/só-falhas;
2. `/admin/requests` — filtrar por **Expirado** (9 registros esperados),
   período, e colar um id na busca;
3. `/admin/requests/[id]` — timeline operacional acima da inspeção do Diário,
   com ordem causal e pontos de atenção;
4. navegar entre telas pesadas (auditoria, push) e ver o **skeleton**;
5. confirmar que nenhuma tela exibe endpoint completo ou chave.

*Nada commitado. Nada pushado.*
