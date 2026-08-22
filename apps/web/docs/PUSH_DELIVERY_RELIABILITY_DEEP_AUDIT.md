# P1 Pré-Piloto — Push Delivery Reliability Deep Audit

**Natureza:** auditoria read-only. Nenhum arquivo de código foi alterado. Nenhum
commit foi feito. Não alterei Notification Center, Request state machine,
cooldown de CareUpdate, nem toquei WhatsApp.

**Gatilho:** incidente físico real — um segundo tester, em device/rede
diferentes, esperava e não recebeu um push.

**Fontes:** leitura direta do banco compartilhado (`push_deliveries`,
`push_subscriptions`, `service_requests`, `audit_logs`, `users`,
`tutor_profiles`, `professional_profiles`) via query read-only, e leitura de
todo o módulo `modules/notifications/**` + `lib/push/client.ts` +
`public/sw.js`. Todas as leituras de timestamp usam `to_char(...)` literal
(sem conversão de timezone do driver), pela lição já estabelecida neste
projeto.

---

## 1. Reconstrução do caso real

Identifiquei os dois testers reais (não-seed) com histórico de push:

| Conta | Papel | User.id | Subscriptions | Estado atual |
|---|---|---|---|---|
| `vflima007@gmail.com` | Tutor | `c6a7fb3b4f9bb04b729d0723b` | 1 | ativa, criada 2026-08-15, nunca revogada |
| `eures.2609@gmail.com` | Profissional | `c6a80863a4fc1fbcab3d5921d` | 1 | ativa, criada 2026-08-15, nunca revogada |

(Os demais `userId` do banco são contas de dev/seed: `vitor.moliveria@gmail.com`,
`tutor.seed@peteen.test`, `profissional.seed@peteen.test`.)

**Todo o histórico de `push_deliveries` desses dois testers:**

| eventType | recipiente | attempted | accepted | failed | lastError | criado |
|---|---|---|---|---|---|---|
| request_accepted | vflima007 | 0 | 0 | 0 | — | 2026-08-15 15:37:40 |
| request_created | eures | 1 | 1 | 0 | — | 2026-08-15 15:36:50 |
| request_created | eures | **1** | **0** | **1** | **`http_403`** | **2026-08-15 21:52:24** |
| request_created | eures | 1 | 1 | 0 | — | 2026-08-19 23:03:43 |
| request_created | eures | 1 | 1 | 0 | — | 2026-08-20 23:13:09 |
| request_created | eures | 1 | 1 | 0 | — | 2026-08-21 14:32:35 |
| request_cancelled | eures | 1 | 1 | 0 | — | 2026-08-21 14:46:49 |

**Achado central da reconstrução:** a única falha real no histórico inteiro
desses dois testers é o `http_403` de 2026-08-15 21:52:24. Investigando:

- O `eventKey` aponta para `ServiceRequest` `cmsuww27j0001dgsc98m9inso` —
  **essa request não existe mais na tabela `service_requests`**, e não há
  **nenhuma** linha em `audit_logs` referenciando esse id, nem qualquer
  `audit_logs` no intervalo 21:30–22:10 daquele dia. Isso não passou pelo
  fluxo normal de criação de request (que sempre grava AuditLog) — é
  consistente com um envio de teste/diagnóstico direto ao dispatcher, não com
  uma request de usuário real perdida.
- **Esse 403 já está documentado.** O arquivo não commitado
  `apps/web/docs/NOTIFICATION_RELIABILITY_PHYSICAL_GATE_RUNBOOK.md`, item 18,
  registra explicitamente: *"Existe uma notificação real que não chegou no
  passado, sem evento identificado (registrado no gate anterior, bloqueado
  por 403 de VAPID)."*
- O comentário-cabeçalho de `modules/notifications/domain/vapid-fingerprint.ts`
  descreve exatamente esse padrão de incidente: dispatcher local (dev) enxerga
  subscriptions criadas em produção (mesmo Supabase compartilhado) e tenta
  assinar com o par VAPID errado → FCM devolve 403 → `PushDelivery` acumula
  `failed` em silêncio, sem alarme.
- O fix para esse incidente foi publicado em **`d31b668`** (2026-08-17, *"fix:
  isolate push subscriptions by environment and VAPID identity"*) — dois dias
  depois do 403. A subscription do `eures` foi criada 08-15 (antes do fix,
  portanto "legado"), e todos os 4 envios **depois** de 08-17 tiveram
  `accepted=1`.

**Classificação da linha do tempo:** o 403 de 08-15 é o incidente **anterior**
já corrigido na causa mais provável (crosstalk dev/produção), não um novo
incidente ainda aberto. **Porém — ponto crítico — o runbook físico criado para
validar esse fix (`NOTIFICATION_RELIABILITY_PHYSICAL_GATE_RUNBOOK.md`) está
100% vazio: nenhum checkbox marcado, nenhuma linha da matriz preenchida.** O
próprio runbook já avisa: *"Não assumir que foi corrigida só porque um evento
atual chega."* Os 4 `accepted=1` pós-fix são sucesso **do servidor**, nunca
confirmados como exibidos no aparelho.

**A linha `request_accepted` de `vflima007` com `attempted=0/accepted=0`** não
é falha: no momento desse evento (08-15 15:37:40), a conta do tutor
(`c6a31f7eaf717757ac028082a`, na verdade `vitor.moliveria@gmail.com` — dono do
`ServiceRequest` de teste, não `vflima007`) **não tinha nenhuma
`PushSubscription`** — a primeira dele só foi criada em 08-16. `attempted=0`
é o comportamento contratado (ver seção 5): zero subscriptions elegíveis nunca
conta como falha.

**Conclusão da seção 1:** a forense de banco **não localiza** um evento
CARE_UPDATE suprimido pelo cooldown, nem um `failed`/`invalid` recente e
inexplicado batendo com "segundo tester, device diferente, agora". O caso mais
provável mora exatamente onde a seção 5 aponta: um push pode ter sido
`PROVIDER_ACCEPTED` no servidor e nunca ter virado `DEVICE_DISPLAYED` — e isso
**não deixa nenhum rastro no banco**, com ou sem bug. Ver seção 9 para um
mecanismo de UI que teria mascarado exatamente esse sintoma para o usuário.

---

## 2. Matriz de eventos de push (contrato atual, confirmado no código)

Fonte: `modules/notifications/application/push-service-request-events.ts`.

| Evento | Destinatário | eventKey | Cooldown/dedup | Kind de copy |
|---|---|---|---|---|
| `request_created` | Profissional | `service-request-created:<requestId>` | único por request | `request_created` |
| `request_accepted` | Tutor | `service-request-accepted:<requestId>` | único (transição PENDING→ACCEPTED só ocorre 1×) | `request_accepted` |
| `service_started` | Tutor | `service-started:<requestId>` | único (ACCEPTED→IN_PROGRESS só ocorre 1×) | `service_started` |
| `care_update` | Tutor | `care-update:<requestId>:<bucketHora>` | **máx. 1/hora/request** — janela embutida na própria chave | `care_update` |
| `service_completed` | Tutor | `service-completed:<requestId>` | único (COMPLETED é terminal) | `service_completed` |
| `request_cancelled` (por tutor) | Profissional | `request-cancelled:<requestId>:tutor` | único | `request_cancelled_by_tutor` |
| `request_cancelled` (por profissional) | Tutor | `request-cancelled:<requestId>:professional` | único | `request_cancelled_by_professional` |

**Explicitamente NÃO conectados** (comentário do próprio arquivo): disputa e
lembretes temporais. Não há push de dispute nem de agenda/scheduling hoje.

**Dedup/idempotência:** um único mecanismo — `PushDelivery.create()` com
unique `(eventKey, recipientUserId, channel)`, chamado **antes** de qualquer
envio. Colisão (P2002) = "já despachado", retorna em silêncio. Não existe
segundo sistema de rate limit ou fila para eventos de negócio.

**Retry:** nenhum (ver seção 11).

---

## 3. Ciclo de vida da subscription

Criação → `createSubscriptionComLimites` (transação com `SELECT...FOR UPDATE`
na linha do usuário; teto de 6 devices ativos, 10 criações/hora — os dois
tetos verificados atomicamente, corrigindo um TOCTOU real encontrado em QA
anterior).

Reuso do mesmo endpoint → `refreshSubscription`: atualiza `p256dh`/`auth`/
identidade/`lastSeenAt`. **Só roda quando o client chama `subscribeToPushAction`
de novo com o mesmo endpoint** — nunca automaticamente.

Revogação:
- `logout` / `user_optout` → ação explícita do usuário, via
  `revokePushOnLogoutAction`/`unsubscribeFromPushAction`. Escopada por
  `userId + endpoint`.
- `gone` (404/410) → **única** origem legítima, disparada pelo dispatcher
  quando o push service confirma que a subscription está morta. Comentário no
  código é explícito: **"NUNCA é acionada por logout. Web Push e Supabase Auth
  são sistemas independentes."** (Isso responde e fecha, com evidência de
  código, a suspeita levantada em investigação anterior desta sessão de que um
  logout pudesse indiretamente derrubar uma subscription por outro caminho —
  não derruba.)
- `account_cleanup` → fluxo de exclusão de conta.

**Pergunta central da seção 3 — relogar no MESMO device reativa push
automaticamente? NÃO.** `subscribeToPushAction` (a única função que persiste
uma subscription no servidor) é chamada em exatamente dois lugares do client:
o clique explícito em "Ativar notificações" (`push-opt-in.tsx`, `ativar()`) e
o retry único de `SUBSCRIPTION_CONFLICT`. Não existe nenhum `useEffect` de
login/mount que chame isso automaticamente. Ver seção 9/10 para o efeito
disso na UI.

**Classificação: P1 pré-piloto** — gap real, mas mitigado hoje porque a UI
mostra "permitido-sem-subscription" quando detecta permissão concedida sem
subscription local. O problema fica pior quando a subscription local do
browser ainda existe mas a do servidor foi revogada — aí a UI não detecta nada
(seção 9).

---

## 4. Subscriptions obsoletas ("stale")

**Sim — uma subscription pode estar `active` no banco sem representar mais um
device que exibe notificações**, por três motivos combinados, todos
confirmados no código:

1. **Nenhum job de limpeza automática existe.** Não há cron/scheduler que
   expire subscriptions antigas por idade ou por `lastSeenAt` parado. Busquei
   em toda a árvore de cron do projeto — nada relacionado a push.
2. **`lastSeenAt` não é um heartbeat de entrega.** Só é atualizado por
   `refreshSubscription`, que só roda quando o client re-executa o fluxo de
   assinatura. Um envio bem-sucedido (`accepted=1`) **não** toca
   `lastSeenAt`. Prova direta no banco: a subscription do `eures` está com
   `lastSeenAt` parado em 2026-08-15 15:34:29 — a mesma data de criação — apesar
   de ter recebido 4 pushes aceitos pelo servidor depois disso (08-19 a
   08-21). Ou seja, hoje `lastSeenAt` mede "a última vez que o usuário clicou
   em ativar/reabriu o fluxo", não "a última vez que o device provavelmente
   estava vivo".
3. **Só 404/410 revogam automaticamente.** Qualquer outro código de falha —
   403, 5xx, timeout de rede — é contado em `failedCount` mas a subscription
   permanece `active` para sempre, sem qualquer sinalização ao usuário. Uma
   subscription presa nesse estado (ex.: 403 persistente por reinstalação do
   app sem desinscrever, ou chave rotacionada de forma anômala) fica "ativa"
   indefinidamente no banco, invisível em qualquer contagem de erro simples.

**Contagem atual:** 2 subscriptions ativas de testers reais (1 cada, sem
duplicata), mais 1 do dev (Vitor). Nenhuma duplicata detectada nos 40 registros
mais recentes da tabela.

**Classificação: P2 polish** para o job de limpeza (não bloqueia o piloto —
volume é baixíssimo); **P1 pré-piloto** para o fato de `lastSeenAt` não ser
confiável como sinal de "device vivo", porque isso alimenta diretamente a
falsa sensação de robustez na seção 9.

---

## 5. "Aceito" ≠ "Exibido" — estados observáveis

Estados que o sistema **de fato registra** hoje, na ordem real do pipeline:

1. `DOMAIN_EVENT_CREATED` — ServiceRequest/CareUpdate persistido (fora do
   módulo de push).
2. `PUSH_ELIGIBLE` — `PushDelivery.create()` bem-sucedido (claim de
   idempotência). Existe mesmo quando não há nenhuma subscription elegível.
3. `PUSH_SUPPRESSED` — só existe para `care_update`: a segunda tentativa
   dentro da mesma janela de 1h colide no unique e retorna
   `alreadyDispatched` sem gerar nova linha nem novo envio.
4. `PUSH_ATTEMPTED` — subscriptions elegíveis > 0, `sendPush` chamado. Fica
   em **zero** (nunca "failed") quando o usuário não tem device compatível ou
   só tem devices de outro ambiente — decisão de contrato explícita no código
   (`dispatch-push.ts`, comentário "CONTRATO OFICIAL, decisão fechada").
5. `PROVIDER_ACCEPTED` — HTTP 2xx do push service. **É o teto do que o
   sistema consegue provar sozinho.**
6. `PROVIDER_REJECTED` — qualquer não-2xx que não seja 404/410 (ex.: 403,
   5xx). Vira `failedCount`, subscription intocada.
7. `SUBSCRIPTION_REVOKED` — só a partir de 404/410 (`gone`) ou ação explícita
   do usuário (logout/opt-out/cleanup).

**O que NÃO é observável em nenhum lugar do sistema hoje:** `DEVICE_DISPLAYED`.
Não existe delivery receipt, não existe confirmação da `Notification` API, o
Service Worker não reporta de volta ao servidor que `showNotification()`
rodou. Isso é reconhecido explicitamente pelos próprios comentários do código
("não é entrega ao device", "não existe `delivered` nem `read`") — não é uma
lacuna escondida, é uma limitação de design já documentada, mas que o
dashboard nenhum hoje deixa visível para quem está triando um "não recebi".

**Instrução da missão respeitada:** em nenhum ponto deste relatório
`acceptedCount` foi tratado como prova de exibição.

---

## 6. Comparação sucesso vs. falha

| Caso | Subscription criada | Ambiente na criação | Resultado | Explicação |
|---|---|---|---|---|
| eures — request_created 08-15 15:36 | mesmo dia, ~2min antes | legado (pré-hardening) | ✅ accepted | dispatcher rodou no ambiente certo |
| eures — request_created 08-15 21:52 | mesma subscription, 6h depois | legado (pré-hardening) | ❌ `http_403` | dispatcher provavelmente rodou em dev, viu subscription de produção, VAPID errado |
| eures — 4 envios entre 08-19 e 08-21 | mesma subscription (nunca recriada) | legado, mas fix de isolamento já em produção desde 08-17 | ✅ accepted × 4 | isolamento por ambiente+fingerprint bloqueia dispatcher fora de produção; em produção, a linha "legada" passa por `legacy_producao` e é adotada após o 1º aceite |
| vflima007 — request_accepted 08-15 15:37 | inexistente ainda | — | `attempted=0` | zero subscriptions no momento do evento (não é falha) |

**Diferença mensurável encontrada:** não há diferença de idade/browser/device
entre os casos de sucesso e o de falha — é a **mesma** subscription nos dois
lados do 403. A variável que muda é o **ambiente de onde o dispatcher rodou**,
que é justamente o que `vapid-fingerprint.ts` e `d31b668` passaram a filtrar.
Não há material (endpoint/chaves) disponível para comparação mais profunda —
corretamente, pois é a única tabela do sistema com esse segredo e não deveria
ser lida fora do dispatcher.

---

## 7. Foreground/background

`public/sw.js`: o handler de `push` chama `showNotification()`
**incondicionalmente** — não há checagem de `document.visibilityState`, nem
qualquer lógica de "não mostrar se o app está aberto". Não encontrei supressão
indevida no client baseada em foreground/background.

**Achado adicional (P2 polish):** eventos como `request_created`,
`request_accepted`, `service_started`, `service_completed` e os dois
cancelamentos compartilham a tag `"peteen-request"`. `showNotification()` não
passa `renotify: true`. Pela spec da Notification API, uma segunda notificação
com a mesma tag **substitui silenciosamente** a anterior (sem novo som/
vibração) se a primeira ainda estiver na tela/bandeja — o SO não re-alerta o
usuário. Um tutor que não viu a notificação de "aceita" pode nunca perceber a
de "iniciado" chegando por trás, porque tecnicamente ela chegou, só não
alertou de novo. Isso é uma explicação plausível — **não confirmada, só
plausível** — para parte dos relatos de "não recebi", especialmente em
sequências rápidas de eventos.

---

## 8. Mapeamento honesto Android/iOS

- **Android (Chrome/Edge):** suporte completo em aba de browser normal — não
  exige instalação como PWA. Código não faz nenhuma distinção especial para
  Android além do teste genérico de suporte a `serviceWorker`/`PushManager`/
  `Notification`.
- **iOS/iPadOS:** Web Push só existe (a partir do iOS 16.4) quando o site foi
  adicionado à Tela de Início e é aberto em modo standalone. Em Safari comum
  (ou Chrome/Firefox no iOS, que rodam sobre o mesmo WebKit), a API
  simplesmente não existe no `window` — o código detecta isso corretamente
  (`iosForaDaTelaDeInicio()`, usando o sinal de `maxTouchPoints > 1` em
  "Macintosh" para capturar iPad disfarçado de Mac) e mostra uma mensagem
  específica orientando a instalar, em vez do genérico "não suportado". Não
  encontrei nenhuma alegação de suporte além do que o WebKit realmente
  oferece.

---

## 9. UX do estado de push na Minha Conta — BUG DE CONFIANÇA CONFIRMADO

`avaliarAmbientePush()` (`lib/push/client.ts`) decide "ativo" chamando
`obterEndpointAtual()`, que só consulta
`navigator.serviceWorker` → `pushManager.getSubscription()` **no browser**.
**Em nenhum momento essa função consulta o servidor** para confirmar que a
`PushSubscription` correspondente ainda existe e está `revokedAt: null` no
banco.

Consequência concreta: se a linha do servidor for revogada por qualquer
caminho (404/410 automático, `account_cleanup`, uma futura ação
administrativa) **enquanto o browser ainda guarda o objeto de subscription
local**, a tela de Minha Conta continua mostrando **"Notificações ativadas
neste dispositivo"** com o ícone de check verde — permanentemente, até que o
usuário desative e reative manualmente (o que nada na UI sugere ser
necessário, porque a UI não percebeu nada de errado).

Isso responde diretamente à pergunta da missão: **sim, "Ativado" pode aparecer
mesmo quando o backend não tem subscription válida.** É exatamente o tipo de
gap que faria um tutor/profissional confiar que está recebendo push quando,
do lado do servidor, o próximo evento nem sequer vai tentar enviar para ele
(cai no caminho `attempted=0` da seção 5, que também não gera nenhum alerta).

**Classificação: P1 pré-piloto.**

---

## 10. Auto-repair — investigação (NÃO implementado)

**É seguro?** Sim, com uma condição: só re-executar o fluxo de subscribe
quando `Notification.permission === "granted"`. Nesse caso,
`reg.pushManager.subscribe()` com a mesma `applicationServerKey` **não abre
prompt nenhum** — o browser devolve a subscription já existente (ou cria uma
nova silenciosamente, sem interação). `Notification.permission === "denied"`
nunca deve disparar nova tentativa — o código já respeita essa regra em todo
lugar e o auto-repair proposto deve herdá-la.

**Menor mecanismo seguro, identificado mas não implementado:** no mount da
`PushOptIn` (ou de um componente equivalente global, tipo o já existente
`CareTimelineAutoRefresh`), quando `avaliarAmbientePush` resolver
`"permitido-sem-subscription"` **ou** `"ativo"`, disparar silenciosamente
`criarSubscription()` em background (sem mudar a UI para "ativando…", sem
bloquear a tela) sempre que:
- `Notification.permission === "granted"`, e
- não houver uma tentativa idêntica nos últimos N minutos (evitar chamadas
  repetidas a cada foco de aba).

Isso cobriria ao mesmo tempo o gap da seção 3 (relogin não reativa) e o da
seção 9 (UI não percebe subscription revogada no servidor), porque
`subscribeToPushAction` já é idempotente: se a subscription do servidor ainda
existe e é do mesmo dono, vira um `refresh` (atualiza `lastSeenAt` de verdade,
resolvendo também a fragilidade da seção 4); se foi revogada, vira uma
`create` nova. Nenhuma mudança de contrato exigida — só um novo ponto de
chamada.

**Não implementado nesta missão**, conforme instrução.

---

## 11. Política de retry — auditoria

**Não existe retry de nenhum tipo hoje**, para nenhuma classe de falha —
decisão de design explícita e documentada no próprio código
(`dispatch-push.ts`: *"Sem fila, sem outbox, sem retry no V0"*).

- 404/410 → tratado como permanente, subscription revogada (`invalid`).
  Correto.
- Qualquer outra falha (403, 5xx, timeout de rede de até 3s, erro de
  configuração VAPID) → contado em `failed`, **nenhuma distinção entre
  transitório e permanente**, nenhuma nova tentativa, subscription intocada.
- O claim de idempotência (`PushDelivery.create()`) acontece **antes** do
  envio — um crash exatamente entre o claim e o envio perde aquele push para
  sempre, e o estado resultante (`attempted=0`) é **indistinguível** de "o
  usuário não tinha device". Risco aceito e documentado no código, não uma
  descoberta desta auditoria — mas relevante repetir aqui porque é
  exatamente o tipo de perda silenciosa que a missão está investigando.

Isso não é uma recomendação de "implementar retry indiscriminado" — a missão
pede só para distinguir transitório de permanente. Hoje essa distinção **não
existe** para nada além de 404/410.

**Classificação: P1 pré-piloto** (risco conhecido e aceito, mas vale reforçar
antes do piloto porque é o mecanismo mais direto para "servidor tentou, não
funcionou, ninguém sabe").

---

## 12. Classificação de eventos críticos — proposta (não implementada)

O código atual **já implementa exatamente** a distinção que a missão propõe,
sem que isso esteja nomeado formalmente em nenhum lugar:

- **CRÍTICO** (tentativa imediata, sem cooldown): `request_created`,
  `request_accepted`, `service_started`, `service_completed`,
  `request_cancelled` (os dois atores). Disputa relevante ainda não está
  conectada a push nenhum — puramente in-app hoje.
- **INFORMATIVO** (protegido por anti-spam): `care_update`, único evento com
  janela de 1h por request.

**Proposta (não implementada):** nomear essa distinção explicitamente como uma
constante de domínio (ex.: exportar `CRITICAL_PUSH_EVENT_TYPES` a partir de
`push-events.ts`), para que qualquer evento novo (disputa, lembrete) precise
declarar-se CRÍTICO ou INFORMATIVO por construção, em vez de a distinção viver
implicitamente em qual função de `push-service-request-events.ts` foi
escrita. Puramente organizacional — nenhuma mudança de comportamento.

---

## 13. WhatsApp — ponto de integração (documentação apenas)

Nenhuma integração feita. O ponto de extensão natural, dado o schema atual:

- `PushDelivery` já tem uma coluna `channel` com default `"push"`, e o unique
  é `(eventKey, recipientUserId, channel)` — o schema **já foi desenhado**
  para múltiplos canais por evento, mesmo que só `"push"` exista hoje.
- `push-service-request-events.ts` já é a **única** ponte entre domínio
  (ServiceRequest) e canal de notificação — nenhuma Server Action de domínio
  chama `dispatchPush` diretamente. Isso significa que adicionar WhatsApp no
  futuro é, estruturalmente, adicionar um `dispatchWhatsapp(...)` chamado a
  partir dos MESMOS pontos (`notifyRequestCreated`, `notifyRequestAccepted`
  etc.), filtrado pela classificação da seção 12 (CRÍTICO apenas — nunca
  `care_update`), com `channel: "whatsapp"` na constraint de dedup.
- O domínio (ServiceRequest, CareUpdate) não precisa e não deve saber que
  WhatsApp existe — a mesma garantia que já vale para push hoje
  (`recipientUserId` sempre resolvido no servidor, nunca vindo do client).

Interface conceitual: `CriticalMessagingEvent → [Push, futuramente WhatsApp
oficial] para eventos CRÍTICOS`. Nenhuma linha de código escrita para isso.

---

## 14. Resultado

### A — Caso real reconstruído
Dois testers reais identificados (`vflima007@gmail.com`,
`eures.2609@gmail.com`). Único evento de falha real no histórico completo
deles é o `http_403` de 2026-08-15, já documentado como o "caso anterior" no
runbook existente e associado à causa mais provável (dispatcher fora de
produção vendo subscription de produção), corrigida em `d31b668`
(2026-08-17). Nenhum evento recente e inexplicado localizado.

### B — Evento
Para o caso 403: `request_created`, entregue ao profissional. Para os demais
eventos recentes desses dois testers: todos os 6 tipos de evento críticos já
passaram por essas duas contas com sucesso do lado do servidor.

### C — Deveria ter gerado push?
Sim, em todos os casos analisados — nenhum era `care_update` (não há
suspeita de supressão por cooldown nos dados encontrados).

### D — Cooldown
Não aplicável ao caso investigado — nenhuma linha de `care_update` aparece no
histórico desses dois testers.

### E — PushDelivery
Ver tabela da seção 1. Um `failed` (403, explicado), seis `accepted`, um
`attempted=0` legítimo (zero subscriptions no momento).

### F — Subscriptions
2 subscriptions reais ativas (1 por tester), nenhuma revogada, nenhuma
duplicata. `lastSeenAt` de ambas parado na data de criação (08-15) —
não é heartbeat de entrega, é heartbeat de re-assinatura manual (seção 4).

### G — Login/logout/relogin
`revokeGoneSubscription` (404/410) é comprovadamente independente de
logout/Supabase Auth (confirmado no código, não só no comentário). Relogar no
mesmo device **não** recria/reativa push automaticamente — exige clique
explícito (seção 3).

### H — Subscription obsoleta
Sim, cenário real e possível hoje: 403/5xx/timeout não revogam, não há job de
limpeza, e a UI (seção 9) não detecta o descompasso. Nenhuma instância
CONFIRMADA disso nos dados atuais, mas o mecanismo que impediria detectá-la
também está confirmado ausente.

### I — Sucessos comparáveis
4 entregas `accepted` para `eures.2609` entre 08-19 e 08-21, todas pós-fix.

### J — Diferença encontrada
A variável que separa sucesso de falha no único caso de falha é o **ambiente
de onde o dispatcher rodou**, não o device/subscription em si (mesma
subscription nos dois lados).

### K — Estados observáveis
Documentados na seção 5. `DEVICE_DISPLAYED` não existe em lugar nenhum do
sistema — limitação de design reconhecida no próprio código, não escondida,
mas sem nenhuma superfície de UI que a explicite hoje.

### L — UX atual
Minha Conta mostra "ativo" a partir de estado 100% local do browser, sem
reconfirmar com o servidor (seção 9). Bug de confiança confirmado por leitura
de código.

### M — Gaps de ciclo de vida
(1) sem auto-reativação em login/relogin; (2) UI não detecta subscription
revogada no servidor; (3) `lastSeenAt` não reflete entregas reais; (4) sem
limpeza automática de subscriptions obsoletas.

### N — Retry
Inexistente para qualquer falha que não seja 404/410. Documentado como risco
aceito no próprio código-fonte, não uma lacuna oculta.

### O — Menor correção segura (não implementada)
Re-executar `criarSubscription()` silenciosamente em background quando
`permission === "granted"`, no mount de um componente global e/ou no login —
idempotente, sem novo prompt, resolve M(1) e M(2) e melhora M(3) de graça
(seção 10). **Não implementado.**

### P — Riscos residuais
- Nenhuma prova física de entrega para NENHUM dos 8 tipos de evento desde o
  hardening de 08-17 — o runbook que existiria para provar isso está vazio.
- `care_update` nunca foi comparado fisicamente com o real comportamento de
  "1 por hora" em device real (só testado via lógica/dedup no banco).
- Tag compartilhada sem `renotify` pode mascarar entregas reais como "não
  chegou" aos olhos do usuário (seção 7) — hipótese, não confirmada.
- Multi-device (mesma conta, dois aparelhos) e troca de conta no mesmo
  aparelho nunca foram exercitados fisicamente nesta auditoria.

### Q — O que só a QA física ainda pode provar
Tudo que envolve `DEVICE_DISPLAYED`, ponto final. Concretamente, e já
roteirizado em `apps/web/docs/NOTIFICATION_RELIABILITY_PHYSICAL_GATE_RUNBOOK.md`
(existente, não executado):
- Os 8 eventos chegando de fato à tela de um device real, por tipo.
- Comportamento com app aberto / background / tela bloqueada / fechado.
- iPhone real, instalado e não instalado na Tela de Início.
- Troca de conta no mesmo aparelho (bloqueante se houver cross-user).
- Multi-device na mesma conta.
- Se o hardening de `d31b668` de fato impede qualquer crosstalk dev/produção
  em um teste físico real, não só em teoria de código.

---

## Classificação consolidada

| # | Achado | Classe |
|---|---|---|
| 9 | UI "Ativado" não reconfirma com o servidor — bug de confiança | **P1 pré-piloto** |
| 3/10 | Sem auto-reativação em relogin/app-open | **P1 pré-piloto** |
| 11 | Zero retry para falha transitória (403/5xx/timeout) | **P1 pré-piloto** |
| — | Runbook físico de validação do hardening `d31b668` nunca executado | **P1 pré-piloto** |
| 4 | `lastSeenAt` não é heartbeat de entrega real | **P2 polish** |
| 4 | Sem job de limpeza de subscriptions obsoletas | **P2 polish** |
| 7 | Tag compartilhada sem `renotify` pode silenciar re-alertas | **P2 polish** |
| 12 | Formalizar constante CRÍTICO/INFORMATIVO | **P2 polish** |
| 13 | Integração WhatsApp | **P3 futuro** |
| 2 | Push de disputa/lembretes temporais | **P3 futuro** |

**Nenhum P0 encontrado** — nenhuma corrupção de dado, nenhum vazamento
cross-user, nenhuma falha de segurança. O risco real pré-piloto é
inteiramente de **observabilidade e confiança de UI**, não de vazamento ou
perda estrutural.

---

*Read-only. Nada corrigido. Nada commitado. Nada pushado.*
