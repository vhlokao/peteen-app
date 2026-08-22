# P1 Pré-Piloto — Push Subscription Health & Auto-Repair

Implementação concluída. **Nada commitado. Nada pushado. Nenhuma migration.**

Restrições respeitadas: Notification Center intocado; cooldown de CareUpdate
intocado; nenhum WhatsApp; nenhum provider trocado; nenhum polling criado.

---

## A. Estado canônico

`modules/notifications/domain/push-health.ts` — função pura, sem browser e sem
banco, exercitada inteiramente por `assert`.

O estado nasce da combinação de **duas observações independentes**:

| Browser | Servidor |
|---|---|
| suporte a SW/PushManager/Notification | existe `PushSubscription` do **mesmo usuário** para este endpoint |
| iOS fora da Tela de Início | `revokedAt IS NULL` |
| VAPID pública configurada | identidade elegível (`runtimeEnvironment` + `vapidKeyFingerprint`) |
| `Notification.permission` | |
| `pushManager.getSubscription()` | |
| opt-out deliberado neste aparelho | |

Cinco estados: **ACTIVE**, **NEEDS_REPAIR**, **DISABLED**, **DENIED**,
**UNSUPPORTED**.

Dois eixos de propósito: `state` decide **lógica**, `reason` decide **copy**.
Sem isso, "navegador incompatível" e "ambiente sem VAPID" — mesmo
comportamento, mensagens opostas — obrigariam a inflar o conjunto de estados
com um caso que ninguém trata diferente.

A elegibilidade de identidade entra na conta de propósito. Uma linha pode estar
viva e ainda assim inalcançável por este runtime (é literalmente o que o
hardening de `d31b668` faz). Nesse caso o dispatcher jamais tentaria enviar —
cai em `attempted = 0`, silencioso — e dizer "ativado" repetiria o mesmo bug de
confiança num lugar novo. A pergunta certa não é "a linha existe?", é "um
evento agora chegaria?".

## B. Causa do falso "Ativado"

`lib/push/client.ts` → `avaliarAmbientePush()` decidia `"ativo"` com
`obterEndpointAtual() !== null`, isto é, **apenas** `pushManager.getSubscription()`
no browser. Nunca consultava o servidor.

Bastava a linha do servidor ser revogada por qualquer caminho (404/410,
`account_cleanup`, ação administrativa) enquanto o browser ainda segurava o
objeto local, e a tela exibia "Notificações ativadas" com check verde **para
sempre** — enquanto o dispatcher já nem tentava enviar.

Fechado por construção, com trava de teste: `copyAfirmaQueEstaAtivo()` percorre
todos os estados e falha se qualquer um que não seja ACTIVE produzir uma copy
que afirme que push funciona.

## C. Reconciliação

`getDevicePushStateAction(endpoint)` — nova Server Action.

- Escopada por `userId` da sessão **e** endpoint. Sem isso seria um oráculo de
  enumeração de devices alheios; com isso, endpoint de terceiro devolve
  exatamente o mesmo resultado que endpoint inexistente.
- Responde **um booleano**. Existe linha? é do dono? ambiente bate? fingerprint
  bate? Tudo colapsa em `false`. Detalhar não ajudaria o usuário (a ação é a
  mesma) e descreveria a configuração de push do servidor. O motivo real vai
  para o log.
- Nunca devolve endpoint, chave, p256dh ou auth. A projeção do repositório
  seleciona só fingerprint e ambiente, que não são segredo.
- **Relança em erro**, de propósito: "não consegui verificar" não pode virar
  "não está ativo", que a UI leria como NEEDS_REPAIR.

A consulta só acontece quando pode mudar a resposta: sem suporte, sem permissão
ou sem subscription local, o veredito já está decidido pelo browser.

**Falha de consulta não é diagnóstico.** Servidor inalcançável → `consultado:
false` → preserva ACTIVE. Um usuário no metrô veria "suas notificações precisam
ser reativadas" sem que nada tivesse acontecido, e aprenderia a ignorar o aviso
— destruindo a utilidade de NEEDS_REPAIR quando ele for verdadeiro.

**Servidor tem, browser não:** a linha antiga do servidor não é revogável daqui
(o browser perdeu o endpoint, e ela pode legitimamente ser de outro aparelho).
O reparo cria uma subscription nova; a órfã morre no primeiro 404/410.

## D. Relogin

`PushHealthReconciler` — componente sem render, montado no `AppShell`, presente
em toda tela autenticada de tutor e profissional.

Montado no shell e não numa tela específica porque o momento que importa é o
**primeiro carregamento após o login**, e senha, magic link e Google OAuth caem
em rotas de destino diferentes.

O ciclo agora fecha: logout revoga (servidor + browser) → login → reconciliação
detecta `permission: granted` sem subscription → re-registra → push volta. Sem
prompt, sem clique, sem a pessoa precisar descobrir que havia algo quebrado.

**Logout continua NÃO marcando opt-out** — é justamente isso que faz o push
voltar. Há teste estrutural travando essa distinção em `logout.ts`/`sign-out.ts`.

## E. Auto-repair

`lib/push/repararPush()` — sequência única, compartilhada pelo botão da Conta e
pela reconciliação automática. Extraída de dentro do `PushOptIn` pelo mesmo
motivo que o logout foi unificado: uma sequência cuja **ordem** importa,
copiada em dois lugares, diverge em silêncio no primeiro ajuste.

**A guarda central:** a primeira linha recusa qualquer coisa que não seja
`permission === "granted"` já concedido. `requestPermission()` não é chamado
aqui e não pode passar a ser — um `denied` é permanente no browser, e um reparo
automático que dispare o prompt queimaria o canal para sempre.

**`subscribe()` sem gesto do usuário:** com a permissão já concedida, o browser
não exige gesto — devolve a subscription existente ou cria outra
silenciosamente. O caminho está implementado. Nos navegadores que ainda assim
exigirem gesto, o `subscribe()` falha com `NotAllowedError`, `assinar()`
classifica como `recusado`, o estado permanece NEEDS_REPAIR e a tela mostra
**"Reativar notificações"**. Os dois caminhos existem; **qual deles o aparelho
real toma é o que só a QA física prova.**

**Single-flight:** em `/conta` há dois chamadores montados ao mesmo tempo
(`PushOptIn` e `PushHealthReconciler`), cada um com a própria trava e nenhum
enxergando o outro. A promessa é compartilhada, então o segundo espera o
primeiro em vez de duplicar negociação com o push service e Server Action.

### Achado durante a implementação — opt-out (bug que eu mesmo ia introduzir)

Depois de "Desativar", a permissão continua `granted` e não há subscription: o
estado técnico é **byte a byte idêntico** ao de um relogin. O reconciliador
religaria em silêncio o que a pessoa acabou de desligar — sem aviso, sem
clique, e sem forma de impedir a não ser bloqueando o site no navegador.

Corrigido com `lib/push/opt-out.ts`: marca deliberada em `localStorage`
(sobrevive a fechar o navegador — preferência que evapora ao fechar a aba não é
preferência), gravada **antes** de revogar, limpa quando a pessoa pede push de
volta. A marca suprime NEEDS_REPAIR → DISABLED, mas **nunca vence a realidade**:
se as duas pontas dizem que push funciona, o estado é ACTIVE e a marca obsoleta
é limpa.

Consequência aceita e documentada: a marca é do aparelho, não da conta. Se A
desativa e B entra no mesmo navegador, B começa vendo "desativadas" com botão de
ativar — um clique a mais, num estado descrito corretamente. O inverso traria de
volta o religamento silencioso.

## F. Classificação de erro

`modules/notifications/domain/push-failure.ts`:

| Classe | Códigos | Revoga? | Retry? |
|---|---|---|---|
| **permanent** | 404, 410, 400, 413, demais 4xx | só 404/410 | não |
| **transient** | timeout/rede (`null`), 429, 5xx | **não** | **sim** |
| **configuration** | 401, 403, VAPID inválida, sender lançou | **não** | não |

**A separação mais importante do arquivo:** `ehSubscriptionMorta()` é
deliberadamente **não derivada** de `PushFailureClass`. Um 413 (payload grande
demais) é permanente — não adianta reenviar — mas a subscription está viva e o
defeito é nosso. Se a revogação fosse `classe === "permanent"`, um bug de
payload nosso revogaria em massa os aparelhos de todos os usuários atingidos, e
cada um teria que reativar manualmente. Só 404/410 revogam, e essa função é a
autoridade única. Há teste explícito para 403 e 413.

401/403 têm classe própria porque o incidente real de 2026-08-15 foi
exatamente isso (`http_403`, sender de outro ambiente). Não é culpa do
aparelho, e nunca pode ser confundido com "device morto".

## G. Retry

Só para `transient`. Máximo **2 reenvios** (3 envios totais), backoff
**300ms → 900ms**, e — o que realmente limita o pior caso — um **prazo de 5s**
verificado antes de cada retry.

O prazo existe porque o dispatch é awaitado **dentro de uma Server Action**,
depois da operação de domínio já persistida: cada milissegundo é latência numa
operação que já deu certo. O desenho faz o retry ajudar onde ajuda e não punir
onde não ajudaria:

- falha rápida (5xx em ~100ms) → consome as duas retentativas, termina em ~1,4s;
- timeout de 3s → o prazo corta depois do segundo envio, em vez de empilhar três
  timeouts e somar mais de 9s.

Retry é **por device**, em paralelo via `allSettled` — não multiplica latência
pelo número de aparelhos. **Não toca a idempotência do evento**: o claim de
`PushDelivery` já aconteceu antes, uma única vez, e o retry vive dentro dele.
Zero risco de duplicar `eventKey`.

Duplicação de notificação no caso timeout-mas-aceito: todo payload carrega
`tag`, e o SO **colapsa** notificações de mesma tag — a segunda substitui a
primeira. O risco residual é um re-alerta, não uma notificação duplicada.

## H. `lastSeenAt`

**Semântica auditada e fixada em código** (bloco de documentação em
`push-repository.ts`, onde quem for consumir o campo passa).

Significa **"registrada ou revalidada pelo browser"**. Não é prova de entrega,
não é heartbeat, não diz que o aparelho está vivo. Evidência: a auditoria
encontrou uma subscription com `lastSeenAt` parado na data de criação **depois
de quatro pushes aceitos**.

Com a reconciliação desta missão ele passa a ser atualizado com regularidade
(login, retorno ao app), o que o torna um sinal de **presença do usuário no
produto** — útil para higiene futura de linhas abandonadas, ainda assim inútil
como prova de entrega.

O nome certo seria `lastRegisteredAt`. Renomear exige migration em tabela viva:
**não feito**, conforme instrução.

## I. UX

| Estado | Texto |
|---|---|
| ACTIVE | "Notificações ativadas neste dispositivo" + Desativar |
| NEEDS_REPAIR | "Notificações precisam ser reativadas" + **Reativar notificações** |
| DENIED | "Notificações bloqueadas no navegador" + como liberar |
| DISABLED | "Notificações desativadas" + **Ativar notificações** |
| UNSUPPORTED (navegador) | "Este navegador não oferece notificações push" |
| UNSUPPORTED (iOS) | "Adicione o Peteen à Tela de Início" |
| UNSUPPORTED (sem VAPID) | "Notificações indisponíveis no momento" |

A copy vem do domínio, não do componente — é a mesma tabela que o teste
percorre. O botão muda de rótulo entre reparar e ativar porque a promessa é
diferente: um restabelece algo que existia, o outro liga pela primeira vez.

**O reparo acontece antes do primeiro render de conteúdo**, para que a pessoa
não veja aviso de um problema que o produto já ia resolver sozinho em 200ms. Só
o que sobrevive ao reparo aparece.

Copy de "ambiente sem VAPID" não culpa o navegador — é problema de operação
nosso.

## J. Testes

`npm run test:push` → **194 passando, 0 falhando** (eram 141).

Novos: `push-health.test.ts` (matriz completa de estado, copy, cadência, travas
estruturais) e `push-failure.test.ts` (classificação, revogação, retry,
diagnóstico).

Cobertura pedida pela missão:

| Cenário | Onde |
|---|---|
| local + servidor ativos → ACTIVE | ✅ |
| local ativo + servidor ausente → NEEDS_REPAIR | ✅ (teste central) |
| local ausente + servidor ativo | ✅ |
| permission denied / unsupported | ✅ |
| relogin com granted | ✅ |
| auto-reregister | ✅ (+ trava: guarda de permissão antes de qualquer trabalho) |
| idempotência | ✅ (`acumularFalha` imutável; single-flight; claim inalterado) |
| 404/410 revogam | ✅ |
| 5xx/timeout retry | ✅ |
| **403 não revoga como stale** | ✅ (+ 413 permanente que também não revoga) |
| sem loop de subscribe | ✅ (trava estrutural: sem `setInterval`/`setTimeout` no reconciliador) |
| sem duplicação de delivery | ✅ |
| isolamento user/device/environment | ✅ (elegibilidade entra no estado canônico) |

Travas estruturais adicionais (o que não dá para testar sem jsdom): nenhum
arquivo do caminho automático contém `requestPermission`; a guarda de permissão
precede `registrarServiceWorker()` e `assinar()`; logout não marca opt-out.

### Bateria de validação

| Comando | Resultado |
|---|---|
| `test:push` | ✅ 194 / 0 |
| `test:notification-read` | ✅ 42 / 0 |
| `test:active-request-sync` | ✅ 52 / 0 |
| `test:invite` | ✅ 36 / 0 |
| `test:agenda` | ✅ 70 / 0 |
| `test:care-media` | ✅ 168 / 0 |
| `typecheck` | ✅ limpo |
| `lint` | ✅ **0 erros** (22 warnings, todos pré-existentes em arquivos não tocados) |
| `build` | ✅ compilou |
| `check-sensitive-data` | ✅ 0 críticos (6 suspeitos, todos pré-existentes em scripts de seed/demo) |
| `git diff --check` | ✅ limpo |

Arquivos novos são untracked e portanto invisíveis a `git ls-files` — varridos
manualmente pelos mesmos padrões: **0 ocorrências**.

## K. Schema

**Nenhuma migration necessária. Nenhuma criada.** O gate do item 8 não precisou
ser acionado.

A telemetria pedida foi derivada dos campos existentes:

| Métrica | Origem |
|---|---|
| attempted | `attemptedCount` (coluna) |
| accepted | `acceptedCount` (coluna) |
| permanent | `invalidCount` (coluna) + `p=` no diagnóstico |
| **transient** | `t=` no diagnóstico |
| **configuration** | `c=` no diagnóstico |
| **retry count** | `r=` no diagnóstico |

`lastError` (VARCHAR(120), já existia, já era gravado como texto solto) passa a
carregar formato fechado: `t=1 c=0 p=0 r=2 last=http_503`, com escritor e leitor
testados lado a lado.

Semântica fixada: `t`/`c`/`p` contam **devices pelo desfecho final** (um device
que falhou duas vezes e depois foi aceito não conta); `r` conta **reenvios
totais**, incluindo os que terminaram em sucesso. Assim `t+c+p` responde
"quantos aparelhos ficaram sem" e `r` responde "quanto custou" — perguntas
diferentes.

Trunca sacrificando `last`, nunca os contadores: um dígito perdido corromperia a
contagem em silêncio; um código truncado continua legível.

`lastError` legado (texto livre pré-missão) devolve `null` no parser, não zeros
— distinguir "linha antiga" de "entrega sem falha" importa.

**Custo honesto, registrado:** telemetria por parsing de string é pior que por
coluna. No dia em que houver dashboard de verdade, a migration certa é
acrescentar `transientCount`/`configCount`/`retryCount`. Enquanto isso, nada é
perdido e o banco não mudou.

## L. QA físico pendente

Runbook atualizado: `NOTIFICATION_RELIABILITY_PHYSICAL_GATE_RUNBOOK.md`, seções
**20–25** novas. **Nada marcado como concluído** — as seções 1–19 continuam
válidas e continuam não executadas.

O que só o aparelho real prova:

1. **§20** — revogar a linha no banco e confirmar que a tela **nunca** continua
   dizendo "ativadas". Bloqueante.
2. **§21** — relogin pelas **três** vias (senha, magic link, Google OAuth), sem
   prompt, com push voltando sozinho e chegando fisicamente.
3. **§22** — "Desativar" **não** ser religado pelo auto-repair, inclusive após
   fechar o navegador. Bloqueante.
4. **§23** — os seis textos de estado, mais modo avião não acusando falso alarme.
5. **§24** — formato estruturado de `lastError` nas entregas novas; nenhuma
   revogação por 401/403.
6. **Se `subscribe()` sem gesto funciona nos aparelhos reais** — o fallback para
   CTA existe, mas qual caminho cada navegador toma é observação física.
7. Tudo das seções 1–19 que segue pendente: entrega física dos 8 eventos,
   foreground/background/tela bloqueada, iPhone standalone, multi-device, troca
   de conta.

---

## Veredito

# 🟢 PUSH SUBSCRIPTION HEALTH & AUTO-REPAIR = APTO PARA QA FÍSICO

Bateria de validação inteira verde, sem migration, sem schema novo, sem polling,
com o contrato de segurança preservado (permissão nunca pedida
automaticamente, revogação só por 404/410, nenhum oráculo de enumeração, nenhum
segredo exposto ao cliente).

**Isto não é "apto para piloto".** O gate físico continua aberto e agora tem
roteiro para o contrato novo. Duas verificações são explicitamente bloqueantes
(§20 e §22).

*Nada commitado. Nada pushado.*
