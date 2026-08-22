# Notification Reliability — Physical Gate — Runbook de Execução

Base: Environment Isolation Hardening publicado em `d31b668`. Migrations já
presentes no banco compartilhado. Produção/dev/preview isolados por
environment + VAPID fingerprint. Care Timeline e Notification Contract
publicados. Backoffice ainda não iniciado.

> **ATUALIZADO — Push Subscription Health & Auto-Repair.**
> Este runbook ganhou as seções 20–24, que cobrem o contrato novo (estado
> canônico, reconciliação, auto-repair, opt-out, classificação de erro e
> retry). As seções 1–19 continuam válidas e **continuam não executadas**.
> Nada aqui está marcado como concluído.

**Este documento é executado por um humano com aparelhos físicos.** O agente
não tem acesso a hardware, câmera ou capacidade de receber push do sistema
operacional — não pode confirmar sozinho que uma notificação "chegou
fisicamente". O papel do agente aqui é: (a) fornecer este roteiro, e (b)
correlacionar cada evento gerado com `PushDelivery`/`PushSubscription` no
banco (item 17), conforme os testes forem sendo executados.

**Regra de ouro:** usar produção para validar subscriptions de produção.
Não usar localhost para isso — é exatamente o cenário que o hardening isola.

---

## 0. Antes de começar

- [ ] Duas contas de QA prontas: uma Tutor, uma Profissional
- [ ] Dois aparelhos/browser contexts diferentes, se possível
- [ ] Não anotar em lugar nenhum: endpoint completo, p256dh, auth, storagePath, signed URL

## 1. Preparação — registrar por device

Para cada device, preencher (sem endpoint/token):

| Campo | Device A (Tutor) | Device B (Profissional) |
|---|---|---|
| Aparelho / SO | | |
| Navegador | | |
| Standalone ou browser | | |
| Permission (default/granted/denied) | | |
| Push ativo? | | |

## 2. Ativação real

Em device com permission limpa, abrir produção.

- [ ] Convite contextual aparece quando elegível
- [ ] Nenhum prompt nativo automático (só após tocar "Ativar notificações")
- [ ] Tocar "Ativar notificações"
- [ ] Prompt nativo do navegador aparece
- [ ] Aceitar
- [ ] Subscription criada
- [ ] UI passa a mostrar Push ativo
- [ ] Conta e Request concordam (mesmo estado nos dois lugares)

Depois de cada ativação, **avisar o agente** para conferir no banco:
- `runtimeEnvironment = production` ✅/❌
- `vapidKeyFingerprint` corresponde ao par de produção ✅/❌ (sem expor o valor)

## 3. request_created

Tutor cria Request válida.

- [ ] Push chega no aparelho do Profissional
- [ ] Copy correta
- [ ] Tap abre `/requests/[id]`
- [ ] Tempo aproximado: ______

## 4. request_accepted

Profissional aceita.

- [ ] Push chega no Tutor
- [ ] Copy correta
- [ ] Tap abre `/tutor/requests/[id]`

## 5. service_started

Profissional inicia (quando o sistema permitir).

- [ ] Tutor recebe "Atendimento iniciado"
- [ ] Tutor NÃO recebe copy de aceite
- [ ] Tap abre a Request correta

⚠️ **Se "Iniciar atendimento" estiver liberado antes do horário operacional**,
registrar como achado **separado**, de Agenda/Service Lifecycle — não misturar
com falha de Push.

## 6. care_update

Profissional publica atualização com foto do picker real do aparelho.

- [ ] Picker nativo abre
- [ ] Preview aparece
- [ ] Upload completa
- [ ] Aparece no Diário
- [ ] Push chega no Tutor
- [ ] Tap abre `/tutor/requests/[id]/diario`

Depois, fazer mais updates dentro da janela de 1h:

- [ ] Todos aparecem no Diário
- [ ] Push NÃO dispara para cada update subsequente

## 7. service_completed

Profissional conclui.

- [ ] Push de conclusão chega no Tutor
- [ ] Deep link correto
- [ ] Request mostra CTA de avaliação quando aplicável

## 8. Cancelamento pelo Tutor

Em nova Request, Tutor cancela.

- [ ] Push chega no Profissional
- [ ] Copy correta
- [ ] Tap abre Request do lado profissional

## 9. Cancelamento pelo Profissional

Profissional cancela.

- [ ] Push chega no Tutor
- [ ] Copy correta
- [ ] Deep link tutor

## 10. Estados do app

Para eventos suficientes, testar com o app/browser:

- [ ] Aberto
- [ ] Background
- [ ] Tela bloqueada
- [ ] Fechado

Separar explicitamente: **FCM accepted** (servidor) vs **notificação
fisicamente exibida** (aparelho). O aparelho é a fonte de verdade — não o
`PushDelivery.acceptedCount`.

## 11. Logout

Com Push ativo, logout do usuário A. Gerar evento para A.

- [ ] Device NÃO recebe Push da conta A após o logout

## 12. Troca de conta (mesmo aparelho)

A ativa Push → logout → B faz login/ativa.

- [ ] Nenhuma notificação cruzada
- [ ] Push da A não aparece para B
- [ ] B funciona normalmente

**Qualquer cross-user aqui é BLOQUEANTE.**

## 13. Multi-device (se possível)

Mesma conta em dois devices com Push ativo.

- [ ] Evento → ambos recebem
- [ ] Revogar/desativar um → o outro continua recebendo

## 14. iPhone (se disponível)

Safari fora de standalone:
- [ ] Orientação correta
- [ ] Nenhum CTA quebrado

Instalado na Tela de Início:
- [ ] Ativar Push
- [ ] Entrega real testada
- [ ] Tap/deep link funciona
- [ ] Background/lock screen testados

## 15. Android / Desktop

Pelo menos um ambiente com fluxo completo:
- [ ] default → granted → Push físico confirmado

## 16. Privacidade — olhar cada Push na lock screen

Confirmar que **nenhum** Push mostra:
- [ ] Conteúdo do Diário
- [ ] Foto
- [ ] Endereço
- [ ] Telefone
- [ ] storagePath
- [ ] Signed URL
- [ ] Motivo de disputa

## 17. Banco / Dispatch — correlação (o agente faz isso)

Para cada Push relevante, o agente correlaciona:

```
evento → PushDelivery → attempted → accepted/failed → chegou fisicamente? (você informa)
```

Confirmar adicionalmente:
- [ ] Identidade mostra sender production + subscription production
- [ ] Nenhum skip por environment mismatch nos devices criados em produção

**Avise o agente a cada evento gerado** (eventKey ou horário aproximado) para
ele consultar o `PushDelivery` correspondente.

## 18. Caso anterior

Existe uma notificação real que não chegou no passado, sem evento
identificado (registrado no gate anterior, bloqueado por 403 de VAPID).

⚠️ **Não assumir que foi corrigida só porque um evento atual chega.** Validar
cada evento deste gate individualmente — o hardening resolve o mismatch de
ambiente; não é prova automática de que a entrega física funciona ponta a
ponta em todo aparelho.

## 19. Matriz final

Preencher conforme os testes avançam:

| EVENTO | DESTINATÁRIO | DEVICE | PERMISSION | SUBSCRIPTION ATIVA | FCM ACCEPTED? | CHEGOU FISICAMENTE? | TEMPO | DEEP LINK | RESULTADO |
|---|---|---|---|---|---|---|---|---|---|
| request_created | | | | | | | | | |
| request_accepted | | | | | | | | | |
| service_started | | | | | | | | | |
| care_update (1º) | | | | | | | | | |
| care_update (repetido) | | | | | | | | | |
| service_completed | | | | | | | | | |
| cancel (tutor) | | | | | | | | | |
| cancel (profissional) | | | | | | | | | |

Classificação por linha: `PROVADO FISICAMENTE` / `PROVADO SOMENTE SERVIDOR` /
`NÃO PROVADO` / `FALHOU`.

---

# Contrato novo — Push Subscription Health & Auto-Repair

As seções abaixo cobrem o que mudou depois da auditoria. Executar **junto** com
as seções 1–19, não no lugar delas.

Pré-requisitos: **2 contas** (1 Tutor, 1 Profissional), **2 aparelhos** em
**redes diferentes**, produção.

## 20. Estado canônico — o falso "Ativado"

O bug corrigido: a Conta dizia "Notificações ativadas" olhando só o browser,
mesmo com a subscription revogada no servidor.

- [ ] Com Push ativo, abrir Minha Conta → mostra **"Notificações ativadas"**
- [ ] Peça ao agente para **revogar a linha no banco** (ele faz isso direto)
- [ ] Recarregar Minha Conta

Resultado esperado — **um dos dois**, nunca "ativado":
- [ ] o auto-repair agiu e voltou a **"Notificações ativadas"** (o normal), **ou**
- [ ] mostra **"Notificações precisam ser reativadas"** com botão

⚠️ **Continuar mostrando "ativadas" sem que o banco tenha linha ativa é
BLOQUEANTE** — é exatamente a regressão que esta missão fecha.

Avisar o agente para conferir se a linha voltou ao banco.

## 21. Relogin — o push tem que voltar sozinho

O caso que motivou tudo: logout revoga, e nada restabelecia.

- [ ] Push ativo no aparelho A
- [ ] Logout pela Conta
- [ ] Agente confirma no banco: `revokedReason = 'logout'`
- [ ] Login de novo na **mesma** conta, no **mesmo** aparelho
- [ ] **Nenhum prompt de permissão aparece** (a permissão já era `granted`)
- [ ] Sem tocar em nada, abrir Minha Conta → **"Notificações ativadas"**
- [ ] Agente confirma: **nova linha ativa** no banco

Repetir entrando por **cada** via, porque caem em rotas diferentes:
- [ ] senha
- [ ] magic link
- [ ] Google OAuth

- [ ] Gerar um evento real e confirmar que o Push **chega fisicamente** depois
      do relogin

## 22. Opt-out tem que ser respeitado

O risco do auto-repair: religar o que a pessoa desligou de propósito.

- [ ] Com Push ativo, tocar **"Desativar"**
- [ ] A tela passa a mostrar **"Notificações desativadas"**
- [ ] **Esperar / trocar de aba / voltar** (dispara a reconciliação)
- [ ] Recarregar a página
- [ ] **Continua desativado** — o auto-repair NÃO religou
- [ ] Fechar o navegador inteiro, abrir de novo → **continua desativado**
- [ ] Gerar um evento → **não chega Push**
- [ ] Tocar **"Ativar notificações"** → volta a funcionar

⚠️ **Religar sozinho depois de "Desativar" é BLOQUEANTE.**

## 23. Estados de UX — a tela nunca pode mentir

Conferir o texto em cada situação:

| Situação | Texto esperado | OK? |
|---|---|---|
| Tudo funcionando | "Notificações ativadas" | [ ] |
| Servidor sem a linha e reparo falhou | "Notificações precisam ser reativadas" | [ ] |
| Bloqueado no navegador | "Notificações bloqueadas no navegador" | [ ] |
| Nunca ativado | "Notificações desativadas" | [ ] |
| iPhone no Safari (fora da Tela de Início) | "Adicione o Peteen à Tela de Início" | [ ] |
| Navegador sem suporte | "Este navegador não oferece notificações push" | [ ] |

- [ ] Em **modo avião**, abrir Minha Conta → **não** acusa "precisam ser
      reativadas" (falha de rede não é diagnóstico)

## 24. Erro e retry — o agente confere no banco

Não dá para forçar 5xx do FCM à mão. O que dá para verificar:

- [ ] Depois dos eventos das seções 3–9, pedir ao agente para ler
      `PushDelivery.lastError` das entregas novas
- [ ] O formato tem que ser o estruturado: `t=… c=… p=… r=… last=…`
- [ ] Entrega limpa → `lastError` **nulo**

Contrato que o agente confirma no banco:
- [ ] nenhuma subscription revogada por 401/403 (só 404/410 revogam)
- [ ] nenhuma duplicação de `PushDelivery` para o mesmo `eventKey` + destinatário

## 25. Matriz do contrato novo

| CENÁRIO | APARELHO | ESTADO MOSTRADO | BANCO CONFERE? | PUSH FÍSICO | RESULTADO |
|---|---|---|---|---|---|
| Push ativo normal | | | | | |
| Linha revogada no banco | | | | | |
| Relogin (senha) | | | | | |
| Relogin (magic link) | | | | | |
| Relogin (Google) | | | | | |
| Desativar → esperar → recarregar | | | | | |
| Desativar → fechar navegador → abrir | | | | | |
| Modo avião | | | | | |
| iPhone standalone | | | | | |

### Veredito final

- 🟢 **APTO PARA PILOTO**
- 🟡 **APTO COM PENDÊNCIA DELIMITADA**
- 🔴 **BLOQUEADO**

---

*Não iniciar Backoffice antes do veredito final.*
