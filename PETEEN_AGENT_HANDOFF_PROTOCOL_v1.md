# PETEEN — AGENT HANDOFF PROTOCOL v1

**Projeto:** Peteen  
**Data:** 2026-06-27  
**Função deste arquivo:** impedir perda de contexto entre agentes e definir um protocolo rígido de continuação do projeto.

Este documento deve ser lido junto com:

1. `PETEEN_MASTER_CONTEXT_v2.md`
2. `PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md`
3. `PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md` — este arquivo

> O objetivo não é apenas explicar o produto.  
> O objetivo é impedir que um novo agente quebre regras de negócio, altere engines sensíveis, duplique módulos ou avance sem validar o que já funciona.

---

## 1. Ordem obrigatória de leitura para qualquer agente

Antes de mexer em qualquer código, o agente deve ler nesta ordem:

```text
1. PETEEN_MASTER_CONTEXT_v2.md
2. PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md
3. PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md
4. Código atual do módulo que será alterado
5. Rotas ligadas ao módulo
6. Guards/contexts envolvidos
7. Queries/actions existentes
8. Componentes existentes
```

Regra:

> Nenhum agente deve implementar algo baseado apenas no prompt da tarefa.  
> Ele precisa primeiro entender o estado atual do produto e o módulo existente.

---

## 2. Estado atual obrigatório antes de continuar

O ponto exato do projeto é:

```text
Etapa 7.5 — Notificações Internas MVP
Status: implementada, validada parcialmente, mas com bug pendente de links/hrefs.
```

O que já funciona:

- rotas de notificações existem
- sino no topo existe
- contador existe
- notificações aparecem
- notifications são derivadas, sem migration
- tutor/profissional/parceiro/admin possuem suas rotas
- typecheck/lint/build passaram na implementação reportada

O que ainda precisa corrigir antes de commit/tag:

```text
BUG 7.5 / Regressão 7.3 — Links quebrados de navegação e notificações
```

Problemas observados:

1. Algumas notificações levam para rotas erradas ou quebradas.
2. Em `/partner/recommendations`, o botão **Perfil público** do profissional recomendado quebrou o caminho.
3. A única notificação que aparentemente funcionou corretamente foi a de disputa.

Regra:

> Não fazer commit/tag da 7.5 até corrigir e retestar esses links.

---

## 3. Primeira tarefa do próximo agente

A primeira tarefa do próximo agente não é criar feature nova.

A primeira tarefa é:

```text
Corrigir links/hrefs da etapa 7.5 e regressão de navegação contextual do parceiro.
```

Escopo permitido:

- corrigir helpers de URL
- corrigir hrefs em notificações
- corrigir href do botão Perfil público em `/partner/recommendations`
- corrigir `from=partner`
- corrigir `returnTo`
- corrigir fallback de links por persona
- retestar navegação

Escopo proibido:

- criar migration
- alterar schema
- alterar Trust Engine
- alterar Ranking Engine
- alterar Recommendation Engine
- alterar Verification Engine
- alterar Trust Graph
- alterar Activity Center
- alterar Disputes
- criar notificações persistidas
- reescrever navegação inteira

---

## 4. Regra de fonte da verdade

O código é a fonte da verdade da implementação atual.

Os documentos são a fonte da verdade de:

- intenção de produto
- decisões já tomadas
- regras de negócio
- roadmap
- limites de segurança
- histórico de validação

Se houver conflito entre documento e código:

1. O agente deve registrar o conflito.
2. Não deve escolher sozinho se a mudança afetar regra de negócio.
3. Deve pedir confirmação ao Vitor antes de alterar comportamento central.

---

## 5. Protocolo obrigatório antes de qualquer alteração

Antes de editar arquivos, o agente deve responder internamente ou no relatório:

```text
1. Qual módulo estou tocando?
2. Quais personas são afetadas?
3. Isso é tela, CRUD, query, engine ou regra de negócio?
4. Há mutation?
5. Precisa audit log?
6. Precisa ownership?
7. Precisa revalidatePath?
8. Existe módulo parecido já criado?
9. Estou duplicando algo?
10. Isso exige Sonnet ou pode ser Composer Fast?
```

Se a tarefa tocar 3 ou mais módulos críticos, usar agente forte/Sonnet.

---

## 6. Quando o agente deve parar e pedir confirmação

O agente deve parar imediatamente e pedir confirmação antes de:

- criar migration
- alterar Prisma schema
- alterar Trust Score
- alterar pesos de confiança
- alterar Ranking Engine
- alterar Recommendation Engine
- alterar Trust Graph
- alterar Verification Engine
- alterar state machine de ServiceRequest
- alterar auth/middleware global
- alterar envs
- excluir arquivos grandes
- renomear módulos
- alterar modelo de monetização
- alterar lógica de roles/personas
- alterar tabela crítica
- criar notificações persistidas
- criar filas, cron, WebSocket ou realtime
- mudar fluxo de solicitação
- mudar fluxo de avaliação
- mudar regra de recorrência

Regra simples:

```text
Se pode quebrar confiança, segurança, reputação, ownership ou dados históricos → parar e perguntar.
```

---

## 7. Tipos de tarefa e agente recomendado

### Composer Fast / agente rápido

Usar para:

- href quebrado
- copy
- label
- ícone
- empty state
- responsividade
- listagem simples
- rota derivada read-only
- formulário simples
- ajuste visual de admin
- fallback de link
- melhorias em cards
- correção de componente isolado

### Sonnet / agente forte

Usar para:

- Trust Score v2
- Ranking real
- Recommendation calibrado
- Trust Graph avançado
- Antifraude avançado
- Agenda/disponibilidade real
- Notificações persistidas
- Onboarding parceiro automático
- Regras de disputa com impacto em confiança
- Refatoração de módulo central
- Mudanças que atravessam múltiplos domínios

Regra prática:

```text
Tela isolada → Composer Fast
Módulo transversal → Sonnet
Engine ou regra de confiança → Sonnet obrigatório
```

---

## 8. Invariantes de arquitetura

Essas regras não podem ser quebradas:

### 8.1 Modularidade

Usar padrão:

```text
modules/<domain>/
├── domain/
├── application/
├── infrastructure/
├── components/
└── index.ts quando necessário
```

### 8.2 Server/client boundary

Client Components não devem importar:

- Prisma
- queries server
- repositories
- actions server indevidamente
- módulos com `"use server"`

### 8.3 Guards

Toda rota protegida deve usar contexto correto:

- tutor → `requireTutorContext`
- profissional → `requireProfessionalContext`
- parceiro → `requirePartnerContext`
- admin → `requireAdmin`

### 8.4 Ownership

Nunca confiar apenas no ID vindo da URL.

Toda mutation precisa validar que o recurso pertence ao usuário/persona atual.

### 8.5 Audit

Toda mutation relevante deve gerar audit.

Visualizar página/lista/notificação não deve gerar audit.

### 8.6 revalidatePath

Toda mutation que altera UI derivada deve revalidar rotas impactadas.

---

## 9. Invariantes de produto

Peteen não é marketplace genérico.

Nunca implementar algo que empurre o produto para:

- leilão de preço
- ranking por menor preço
- volume acima de confiança
- venda direta de reputação
- recomendação comprada sem contexto
- destaque sem elegibilidade mínima
- confiança inflada por pouco dado

Princípios imutáveis:

```text
Confiança é o produto.
Recorrência vale mais que estrela isolada.
Parceiro ajuda, mas não compra confiança.
WhatsApp é comunicação, não fluxo central.
Solicitação nasce dentro da plataforma.
Tutor não paga no MVP.
Profissional define preço.
Ranking não prioriza menor preço.
```

---

## 10. Invariantes de UX

A interface deve usar linguagem humana.

Evitar termos técnicos em tela:

| Evitar | Usar |
|---|---|
| Trust Score | Índice de Confiança |
| Trust Graph | Rede de Confiança |
| Reviews | Avaliações |
| Risk Score | Índice de Risco |
| Activity Center | Atividades |
| Recommendation Engine | Recomendações |
| Relationship | Histórico / Relacionamento |

Regra:

> Código pode ser técnico. Interface deve ser humana.

---

## 11. Invariantes de navegação

### Tutor

Links de solicitação do tutor devem ir para:

```text
/tutor/requests/[requestId]
```

Nunca mandar tutor para:

```text
/requests/[id]
```

### Profissional

Links de solicitação do profissional devem ir para:

```text
/requests/[id]
```

Nunca mandar profissional para:

```text
/tutor/requests/[id]
```

### Parceiro

Links de perfil público de profissional vindos do parceiro devem preservar contexto:

```text
/discover/[professionalId]?from=partner&returnTo=/partner/recommendations
```

ou:

```text
/discover/[professionalId]?from=partner&returnTo=/partner/notifications
```

A página pública deve permitir voltar para a origem correta.

### Admin

Links admin devem ir para rotas admin:

```text
/admin/disputes
/admin/verifications
/admin/reviews
/admin/flags
/admin/partners
/admin/audit
```

---

## 12. Checklist de regressão de links

Sempre que mexer em navigation, notifications, partner portal ou public profile, testar:

```text
1. /partner/recommendations → Perfil público
2. /discover/[professionalId]?from=partner&returnTo=/partner/recommendations → Voltar ao portal parceiro
3. /partner/notifications → notificação de profissional → perfil público
4. Voltar → /partner/notifications
5. /tutor/notifications → solicitação → /tutor/requests/[id]
6. /professional/notifications → solicitação → /requests/[id]
7. /admin/notifications → disputa → /admin/disputes
8. /admin/notifications → verificação → /admin/verifications
```

Nenhum href pode virar:

```text
undefined
[object Object]
//discover
/partner/discover
/tutor/requests/undefined
/requests/undefined
```

---

## 13. Checklist de validação por persona

### Tutor

Testar:

- dashboard
- pets
- solicitações
- detalhe da solicitação
- avaliação
- disputa
- atividades
- notificações
- perfil de profissional

### Profissional

Testar:

- dashboard
- solicitações recebidas
- detalhe da solicitação
- serviços
- clientes
- pets atendidos
- avaliações
- métricas
- atividades
- notificações

### Parceiro

Testar:

- dashboard
- recomendações
- botão Perfil público
- métricas
- perfil
- atividades
- notificações
- `/partner/pending`

### Admin

Testar:

- dashboard
- auditoria
- disputas
- verificações
- parceiros
- atividades
- notificações
- reviews/flags quando alterados

---

## 14. Definition of Done obrigatória

Nenhuma etapa deve ser considerada concluída sem:

```bash
npm run typecheck
npm run lint
npm run build
```

E sem relatório contendo:

```text
- objetivo da tarefa
- arquivos criados
- arquivos alterados
- rotas alteradas/criadas
- actions/queries alteradas
- ownership aplicado
- audit aplicado ou motivo para não aplicar
- revalidatePath aplicado ou motivo para não aplicar
- validações executadas
- testes manuais recomendados
- limitações conhecidas
- riscos remanescentes
```

---

## 15. Regra de commit/tag

Não fazer commit/tag automático sem confirmação do Vitor.

Fluxo correto:

```bash
git status
npm run typecheck
npm run lint
npm run build
```

Depois, se Vitor validar manualmente:

```bash
git add .
git commit -m "feat: etapa X.X descricao"
git tag -a vX.X.X -m "Etapa X.X validada"
git push origin main
git push origin vX.X.X
```

Se houver bug pendente, não taguear como validado.

Status atual:

```text
7.5 ainda não deve ser tagueada enquanto os bugs de href não forem corrigidos.
```

---

## 16. Roteiro para auditoria profunda Sonnet

Antes de mexer em Trust Score, Ranking, Recommendation, Trust Graph ou Antifraude, Sonnet deve fazer auditoria sem alterar código.

A auditoria deve mapear:

### 16.1 Trust Events

- onde são criados
- quais ações geram eventos
- quais eventos faltam
- se há duplicidade
- se eventos negativos existem
- se há histórico suficiente

### 16.2 Trust Score atual

- fórmula atual
- pesos atuais
- bônus atuais
- penalidades atuais
- cold start
- score com poucos dados
- score explicável
- impacto de verificação
- impacto de recorrência
- impacto de recomendação

### 16.3 Recorrência

- quando vira recorrente
- como relacionamento é calculado
- como recorrência impacta confiança
- se recorrência pode ser fraudada

### 16.4 Reviews

- janela de avaliação
- review única por serviço
- média real
- comentário obrigatório em negativa
- moderação
- review removida/ocultada
- efeito sobre confiança

### 16.5 Partner Recommendation

- como recomendações são criadas
- se parceiro pode inflar confiança
- se recomendação inativa ainda pesa
- se parceiro verificado pesa diferente
- se recomendação antiga deve perder força

### 16.6 Verification

- diferença entre solicitação aprovada e selo ativo
- suspensão/reativação
- impacto no índice de confiança
- diferença entre profissional e parceiro

### 16.7 Disputes

- disputa aberta
- em análise
- resolvida
- se deve impactar score
- quando não deve impactar
- risco de abuso por tutor/profissional

### 16.8 Fraud Signals

- sinais existentes
- sinais ausentes
- rate limits
- padrões de abuso
- recomendações cruzadas suspeitas
- reviews combinadas
- contas novas inflando score

### 16.9 Ranking Engine

- fontes de dados usadas
- peso da proximidade
- peso da confiança
- peso da recorrência
- peso da disponibilidade futura
- risco de menor preço dominar ranking

### 16.10 Recommendation Engine

- quem recomenda quem
- por quê
- explicabilidade
- histórico tutor-profissional
- parceiro recomendado
- contexto pet/bairro/serviço

### 16.11 Trust Graph

- nós
- arestas
- pesos
- origem das conexões
- conexões suspeitas
- visualização pública vs admin

Resultado da auditoria Sonnet:

```text
1. mapa do estado atual
2. lacunas
3. riscos
4. proposta de Trust Score v2
5. proposta de Ranking v2
6. proposta de Recommendation v2
7. plano incremental sem quebrar MVP
8. lista de tarefas pequenas para Composer Fast executar depois
```

---

## 17. Não transformar auditoria em implementação imediata

Auditoria Sonnet não deve sair implementando tudo.

Fluxo correto:

```text
1. Sonnet audita
2. Sonnet propõe
3. Vitor aprova
4. Dividir em subetapas pequenas
5. Implementar com segurança
6. Testar cada impacto
7. Medir regressões
```

Nunca:

```text
Auditar e refatorar Trust Score inteiro no mesmo prompt.
```

---

## 18. Pendências conhecidas que não devem ser esquecidas

Lista de pendências além do bug atual:

```text
- melhorar labels de entidade na auditoria, especialmente Dispute e TrustConnection
- onboarding parceiro com vínculo automático PartnerProfile → Partner
- evitar necessidade de SQL manual para parceiro
- agenda/disponibilidade real
- /professional/agenda ainda placeholder
- notificações persistidas no futuro
- lida/não lida real
- disputa com timeline/avisos mais claros
- avaliar impacto futuro de disputas no Trust Score
- revisar Trust Score com Sonnet antes de calibrar pesos
- revisar Ranking/Recommendation com Sonnet antes de expor como engine real
- revisar Antifraude Avançado como camada transversal
- revisar RLS/permissões antes de beta externo
- seed/demo data segura
- teste ponta a ponta antes de usuários reais
```

---

## 19. Prompt bootstrap para novo agente

Use este prompt ao iniciar outro agente:

```text
Você está assumindo o projeto Peteen.

Antes de qualquer resposta ou código, leia obrigatoriamente:

1. PETEEN_MASTER_CONTEXT_v2.md
2. PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md
3. PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md

Este projeto não é marketplace genérico. É uma rede de confiança para cuidados pet baseada em reputação contextual, recorrência, validação social, parceiros e segurança emocional.

Não reescreva arquitetura.
Não crie migrations sem confirmação.
Não altere Trust Score, Ranking, Recommendation, Verification, Trust Graph ou state machine sem autorização.
Não duplique módulos.
Não avance para feature nova antes de corrigir o bug atual.

Estado atual:
A etapa 7.5 Notificações Internas MVP foi implementada, mas há bugs de links/hrefs. Algumas notificações levam para rotas erradas e o botão Perfil público em /partner/recommendations quebrou.

Sua primeira tarefa é auditar e corrigir apenas links/hrefs relacionados à 7.5 e navegação contextual do parceiro.

Depois rode:

npm run typecheck
npm run lint
npm run build

Retorne relatório com causa, arquivos alterados, href antes/depois, testes manuais e riscos remanescentes.
```

---

## 20. Checklist anti-vacilo final

Antes de qualquer entrega, o agente deve confirmar:

```text
[ ] Li os 3 documentos de contexto.
[ ] Entendi que Peteen não é marketplace.
[ ] Entendi o bug atual.
[ ] Não alterei schema sem autorização.
[ ] Não alterei engines sem autorização.
[ ] Não quebrei ownership.
[ ] Não criei duplicidade de módulo.
[ ] Não misturei tutor/profissional nas rotas.
[ ] Não gerei href undefined.
[ ] Não gerei [object Object].
[ ] Não mudei regra de negócio sem aprovação.
[ ] Rodei typecheck.
[ ] Rodei lint.
[ ] Rodei build.
[ ] Listei testes manuais.
[ ] Informei limitações.
[ ] Não recomendei commit/tag se ainda existe bug.
```

---

## 21. Mensagem final para o agente

Você está entrando em um projeto com muito contexto acumulado.

O valor do Peteen está na combinação de:

- confiança contextual
- recorrência real
- reputação explicável
- parceiros confiáveis
- histórico de relacionamento
- segurança emocional
- antifraude progressivo

Não trate como CRUD comum.

Não trate como marketplace.

Não trate cada tela isoladamente quando ela afetar reputação, confiança ou relacionamento.

A melhor contribuição de um novo agente agora é:

1. respeitar o que já foi validado
2. corrigir bugs com precisão
3. proteger engines sensíveis
4. documentar riscos
5. avançar incrementalmente

O projeto já tem uma base forte.  
O próximo agente deve preservar essa base antes de tentar melhorá-la.
