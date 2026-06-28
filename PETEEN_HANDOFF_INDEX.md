# PETEEN — HANDOFF INDEX

**Versão:** v1  
**Data:** 2026-06-27  
**Projeto:** Peteen  
**Função deste arquivo:** ser a primeira página de leitura obrigatória para qualquer novo agente de IA que assumir o projeto.

---

## 1. Leia isto antes de qualquer coisa

Você está assumindo um produto já avançado.

Não trate este projeto como scaffold, protótipo vazio ou app genérico.

Peteen é uma plataforma SaaS/rede de confiança para cuidados pet. O produto não é marketplace. A tese central é:

> Peteen é uma rede confiável de pessoas, profissionais e parceiros para cuidar de pets, baseada em confiança contextual, recorrência, reputação, validação social e segurança emocional.

Antes de responder, planejar ou implementar qualquer coisa, leia os arquivos abaixo na ordem indicada.

---

## 2. Ordem obrigatória de leitura

### 1) `PETEEN_MASTER_CONTEXT_v2.md`

Leia primeiro.

Este é o contexto-mãe do produto.

Ele explica:

- visão do produto
- filosofia da Peteen
- atores do sistema
- arquitetura técnica
- stack
- rotas
- módulos existentes
- etapas implementadas
- bugs conhecidos
- estado atual
- roadmap
- decisões de negócio
- linguagem e UX
- comandos recorrentes

Sem ler este arquivo, você não entende o produto.

---

### 2) `PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md`

Leia em seguida.

Este arquivo explica como dividir trabalho entre agentes simples e agentes fortes.

Ele cobre:

- quando usar Composer Fast
- quando usar Sonnet
- quais tarefas são simples
- quais tarefas são críticas
- auditoria funcional já realizada
- pendências herdadas da auditoria
- auditoria futura das engines
- Trust Score
- Ranking Engine
- Recommendation Engine
- Trust Graph
- Antifraude
- plano futuro de evolução das camadas sensíveis

Sem ler este arquivo, você pode mexer no lugar errado ou subestimar tarefas críticas.

---

### 3) `PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md`

Leia por último antes de executar.

Este é o protocolo anti-vacilo.

Ele explica:

- o que fazer antes de alterar código
- quando parar e pedir confirmação
- o que nunca alterar sem autorização
- regras de schema/migrations
- regras para engines sensíveis
- checklist de regressão
- checklist por persona
- definition of done
- protocolo de commit/tag
- como validar uma etapa

Sem ler este arquivo, você pode quebrar o projeto mesmo entendendo o produto.

---

## 3. Estado atual exato do projeto

A Peteen está na etapa **7.5 — Notificações Internas MVP**.

A etapa foi implementada, mas ainda **não deve ser commitada/tagueada** porque há bug pendente de links/hrefs.

### Já funciona

- rotas de notificações existem
- sino no topo existe
- contador existe
- notificações aparecem
- notificações são derivadas dos dados existentes
- não houve migration
- não existe tabela Notification
- não há lida/não lida persistido
- admin/tutor/profissional/parceiro têm suas páginas

### Pendente antes do commit da 7.5

Corrigir links quebrados:

1. Algumas notificações levam para rotas erradas ou inexistentes.
2. Em `/partner/recommendations`, o botão **Perfil público** do profissional recomendado quebrou o caminho.
3. A única notificação que aparentemente funcionou corretamente foi a de disputa.

---

## 4. Primeira tarefa do próximo agente

A primeira tarefa não é criar feature nova.

A primeira tarefa é corrigir:

```text
BUG 7.5 / Regressão 7.3 — Links quebrados de navegação e notificações
```

### Objetivo

Corrigir apenas links/hrefs.

### Não alterar

- schema
- migrations
- Trust Engine
- Ranking Engine
- Recommendation Engine
- Verification Engine
- Trust Graph
- Growth Engine
- Service Request State Machine
- Activity Center
- Disputes
- regras de negócio

### Auditar principalmente

- `modules/partner-portal/domain/navigation.ts`
- componentes de recomendações do parceiro
- queries/hrefs de notificações
- helpers `buildDiscoverUrl`
- helpers `resolvePublicPageBackLink`
- links para `/discover/[professionalId]`
- links para `/partners/[slug]`
- uso de `returnTo`
- uso de `from=partner`
- `encodeURIComponent`
- URLs relativas quebradas
- `undefined`
- `[object Object]`
- paths duplicados

---

## 5. Regras corretas de destino dos links

### Tutor

```text
solicitação criada/aceita/concluída → /tutor/requests/[requestId]
avaliação pendente → /tutor/requests/[requestId]
disputa criada/status alterado → /tutor/requests/[requestId]
profissional relacionado → /tutor/professionals/[professionalId]
fallback → /tutor/notifications
```

Nunca enviar tutor para `/requests/[id]`, pois essa é rota profissional.

---

### Profissional

```text
nova solicitação → /requests/[requestId]
solicitação cancelada/concluída → /requests/[requestId]
avaliação recebida → /professional/reviews
disputa aberta → /requests/[requestId]
cliente recorrente → /professional/clients/[tutorId]
recomendação recebida → /professional/metricas ou /professional/activity
fallback → /professional/notifications
```

Nunca enviar profissional para `/tutor/requests/[id]`.

---

### Parceiro

```text
recomendação criada/ativada/desativada → /partner/recommendations
profissional indicado recebeu avaliação → /discover/[professionalId]?from=partner&returnTo=/partner/notifications
profissional indicado tornou-se recorrente → /partner/metrics ou /partner/recommendations
verificação do parceiro → /partner/profile
fallback → /partner/notifications
```

Link correto em `/partner/recommendations`:

```text
/discover/[professionalId]?from=partner&returnTo=/partner/recommendations
```

Na página pública do profissional, o botão de voltar deve retornar para:

```text
/partner/recommendations
```

Quando veio de notificações, deve retornar para:

```text
/partner/notifications
```

---

### Admin

```text
disputa aberta → /admin/disputes
verificação pendente → /admin/verifications
avaliação/moderação → /admin/reviews
flag/risk → /admin/flags
parceiro sem vínculo → /admin/partners
auditoria relacionada → /admin/audit
fallback → /admin/notifications
```

---

## 6. Validação obrigatória após corrigir o bug atual

Após corrigir os links, testar manualmente:

### Parceiro

- abrir `/partner/recommendations`
- clicar em **Perfil público**
- deve abrir `/discover/[professionalId]?from=partner&returnTo=/partner/recommendations`
- no perfil público, clicar em **Voltar ao portal parceiro**
- deve voltar para `/partner/recommendations`
- abrir `/partner/notifications`
- clicar em notificação de profissional indicado
- deve abrir `/discover/[professionalId]?from=partner&returnTo=/partner/notifications`
- botão voltar deve retornar para `/partner/notifications`

### Tutor

- abrir `/tutor/notifications`
- clicar em solicitação/disputa/avaliação pendente
- deve ir para `/tutor/requests/[requestId]`

### Profissional

- abrir `/professional/notifications`
- clicar em solicitação/disputa
- deve ir para `/requests/[requestId]`
- clicar em avaliação recebida
- deve ir para `/professional/reviews`

### Admin

- abrir `/admin/notifications`
- clicar em disputa
- deve ir para `/admin/disputes`
- clicar em verificação
- deve ir para `/admin/verifications`
- clicar em parceiro sem vínculo
- deve ir para `/admin/partners`

### Auditoria

- abrir notificações não deve criar AuditLog novo.

---

## 7. Comandos obrigatórios antes de considerar concluído

```bash
npm run typecheck
npm run lint
npm run build
```

Se qualquer um falhar, a tarefa não está concluída.

---

## 8. Commit/tag somente depois da correção

Quando os links forem corrigidos e os testes passarem:

```bash
git add .

git commit -m "feat: etapa 7.5 internal notifications mvp"

git tag -a v0.7.5 -m "Etapa 7.5 validada"

git push origin main

git push origin v0.7.5
```

Não criar tag v0.7.5 antes de corrigir o bug de links.

---

## 9. Regra de ouro sobre dificuldade das tarefas

### Composer Fast pode fazer

- links/hrefs
- labels
- copy
- UI simples
- empty states
- CRUD simples
- listagens
- botões
- formulários simples
- pequenas correções de layout
- ajustes de navegação

### Sonnet deve fazer

- Trust Score
- Ranking Engine
- Recommendation Engine
- Trust Graph
- Antifraude
- Agenda/Disponibilidade
- Notificações persistidas
- Onboarding parceiro automático
- alterações em múltiplos módulos
- mudanças em máquina de estado
- mudanças de schema relevantes
- regras de negócio transversais

Regra simples:

```text
Se for tela/CRUD/link/copy → Composer Fast.
Se atravessar 3+ módulos ou mexer em confiança/reputação/estado → Sonnet.
```

---

## 10. Motores sensíveis que não devem ser mexidos casualmente

Tratar como áreas críticas:

- Trust Engine
- Trust Score / Índice de Confiança
- Trust Events
- Ranking Engine
- Recommendation Engine
- Trust Graph
- Verification Engine
- Antifraude
- Service Request State Machine
- Recorrência
- Review rules
- Partner recommendation rules

Qualquer alteração nessas áreas precisa de plano, auditoria e validação forte.

---

## 11. Auditorias futuras obrigatórias

Existe uma auditoria funcional já realizada e parte dela foi resolvida nas etapas 6.8 a 7.5.

Mas ainda falta uma auditoria mais profunda, preferencialmente com Sonnet, sobre:

- Trust Score real
- pesos de confiança
- eventos de confiança
- impacto de recorrência
- impacto de avaliação
- impacto de recomendação de parceiro
- impacto de disputa
- impacto de verificação
- sinais antifraude
- Ranking Engine
- Recommendation Engine
- Trust Graph
- manipulação de reputação
- inconsistências entre UI e cálculo real

Essa auditoria não deve ser executada com pressa nem misturada com correções simples.

---

## 12. Pendências importantes que não podem ser esquecidas

Após fechar 7.5:

1. Agenda e disponibilidade do profissional
2. Onboarding parceiro com vínculo automático `PartnerProfile.linkedPartnerId`
3. Disputa com UX mais clara
4. Melhorar labels de entidades no Admin Audit
5. Auditoria profunda das engines de confiança
6. Notificações persistidas futuramente
7. Revisão de RLS/permissões antes de beta real
8. Seed/demo para teste externo
9. Revisão mobile/responsiva
10. Teste ponta a ponta do MVP

---

## 13. Nunca colocar nos documentos

Não inserir:

- senhas
- DATABASE_URL completo
- DIRECT_URL completo
- SUPABASE_SERVICE_ROLE_KEY
- tokens
- secrets
- credenciais reais
- dados pessoais sensíveis

Credenciais devem ficar apenas no ambiente local.

---

## 14. Informações operacionais a confirmar manualmente

Antes de continuar, confirmar com o usuário ou no repositório:

- branch atual
- último commit real
- última tag real
- se v0.7.4 foi de fato tagueada
- se 7.5 ainda está sem commit
- usuários de teste disponíveis
- se parceiro de teste ainda está vinculado corretamente

Não inventar essa informação.

---

## 15. Prompt bootstrap para novo agente

Copie e cole para o novo agente:

```text
Você está assumindo o projeto Peteen.

Antes de responder ou implementar qualquer coisa, leia estes arquivos na ordem:

1. PETEEN_MASTER_CONTEXT_v2.md
2. PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md
3. PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md
4. PETEEN_HANDOFF_INDEX.md

Depois disso, confirme que entendeu:

- o que é a Peteen
- qual é o estado atual
- qual é a tarefa imediata
- o que você não pode alterar
- quais validações são obrigatórias

A primeira tarefa é corrigir o BUG 7.5 / Regressão 7.3 de links quebrados em notificações e no botão Perfil público de /partner/recommendations.

Não crie feature nova.
Não altere schema.
Não altere engines.
Não mexa em Trust/Ranking/Recommendation/Verification/Trust Graph/Growth.
Corrija apenas hrefs/links.

Depois rode:

npm run typecheck
npm run lint
npm run build

E retorne relatório com causa, arquivos alterados, links antes/depois e testes manuais.
```

---

## 16. Critério final de aceite para o próximo agente

A próxima entrega só pode ser considerada pronta quando:

- links das notificações funcionarem por persona
- botão Perfil público em `/partner/recommendations` funcionar
- returnTo do parceiro funcionar
- nenhum link apontar para rota de persona errada
- fallback seguro existir
- typecheck passar
- lint passar
- build passar
- relatório for entregue
- usuário validar manualmente

Só depois disso fechar v0.7.5.

---

## 17. Mensagem final

A Peteen já tem uma base forte.

O maior risco agora não é falta de feature.

O maior risco é um agente novo tentar simplificar demais, reescrever partes sensíveis, criar duplicidade ou tratar confiança como nota simples.

A regra central permanece:

> Confiança deve ser difícil de ganhar, fácil de perder e impossível de comprar.

Toda implementação deve proteger essa tese.
