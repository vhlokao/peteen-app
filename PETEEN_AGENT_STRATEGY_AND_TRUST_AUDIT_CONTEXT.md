# PETEEN — AGENT STRATEGY, AUDITORIAS E ROADMAP DE ENGINES

**Versão:** v1  
**Data:** 2026-06-27  
**Projeto:** Peteen  
**Função deste documento:** complementar o `PETEEN_MASTER_CONTEXT_v2.md` com uma camada que ainda precisava ficar explícita: como usar diferentes IAs/agentes no projeto, quais tarefas são simples ou complexas, qual auditoria funcional já foi feita, quais pontos foram resolvidos depois dela, quais pendências permanecem e como conduzir futuras auditorias profundas de Trust Score, Ranking, Recommendation, Trust Graph e Antifraude.

> Este documento não substitui a Bíblia/Master Context.  
> Ele deve ser lido junto com ela antes de qualquer agente implementar tarefas futuras.

---

## 1. Por que este documento existe

O projeto Peteen evoluiu muito rápido com apoio de IA. Em várias etapas, agentes diferentes foram usados para criar módulos, corrigir bugs, revisar UX e implementar fluxos.

Com o avanço do produto, ficou claro que nem toda tarefa deve ser entregue ao mesmo tipo de agente.

Algumas tarefas são mecânicas e seguras:

- corrigir links
- ajustar textos
- criar páginas simples
- melhorar empty states
- adicionar botões
- criar listagens simples
- corrigir labels de auditoria

Outras tarefas são profundas e arriscadas:

- alterar Trust Score
- mudar Ranking Engine
- recalibrar Recommendation Engine
- criar Antifraude Avançado
- mexer em Trust Graph
- alterar state machine de solicitações
- criar agenda/disponibilidade real
- criar notificações persistidas
- mexer em múltiplos módulos ao mesmo tempo

A partir deste ponto, o projeto precisa de uma regra clara:

> Agente rápido executa tarefas bem delimitadas.  
> Agente forte faz auditorias, arquitetura e mudanças que atravessam módulos críticos.

---

## 2. Regra principal sobre uso de IA

### 2.1 Composer Fast / agente rápido

Usar para tarefas de baixa ou média complexidade.

Bom para:

- corrigir href/link quebrado
- ajustar navegação
- corrigir copy
- melhorar layout
- criar cards
- criar formulários simples
- criar rotas CRUD isoladas
- criar listagens
- corrigir labels no admin
- ajustar empty state
- corrigir ícones
- adicionar botão
- corrigir revalidatePath
- bugs pontuais
- responsividade
- componentes visuais
- relatórios simples
- queries read-only
- notificações derivadas sem schema
- activity read-only

Não usar para:

- alterar engines centrais
- mudar pesos de confiança
- mexer em ranking real
- criar algoritmo antifraude
- mexer em state machine
- criar migrations sensíveis
- mudar auth/persona global
- criar agenda real com conflitos
- criar sistema de disponibilidade com concorrência
- alterar regra de reputação

### 2.2 Sonnet / agente forte

Usar para tarefas de alta complexidade, auditoria profunda e decisões estruturais.

Bom para:

- auditoria completa de código
- leitura transversal de módulos
- arquitetura de engines
- trust score avançado
- ranking/recommendation real
- antifraude avançado
- trust graph avançado
- agenda/disponibilidade
- notificações persistidas
- onboarding parceiro automático
- conciliação de estados
- regras de negócio que impactam vários atores
- revisão de segurança/ownership
- revisão de schema antes de migration
- plano antes da implementação

### 2.3 Regra prática

```text
Se for tela, texto, link, CRUD simples ou listagem → Composer Fast.

Se atravessa 3+ módulos, mexe em regra de negócio, estado, confiança, ranking ou banco → Sonnet.
```

### 2.4 Padrão ideal de trabalho

Para tarefas críticas:

```text
1. Sonnet audita e cria plano.
2. Usuário aprova o plano.
3. Composer Fast executa tarefas pequenas e separadas.
4. Sonnet revisa depois, se necessário.
```

Esse padrão evita que um agente rápido altere partes sensíveis sem entender o impacto.

---

## 3. Classificação oficial de dificuldade

### 3.1 Nível 1 — Baixo risco

Pode ir para Composer Fast.

Exemplos:

- copy e nomenclatura
- labels visuais
- empty states
- botões
- ícones
- ajustes de sidebar/nav
- correção de href simples
- fallback de página
- textos de status
- pequenos cards
- melhorar apresentação de audit logs

Regras:

- não alterar schema
- não alterar engines
- não alterar guards
- não criar nova regra de negócio

### 3.2 Nível 2 — Médio risco

Pode ir para Composer Fast com prompt bem fechado.

Exemplos:

- CRUD isolado usando entidade já existente
- tela de listagem
- formulário simples
- query read-only
- rota dedicada por persona
- componente de card/lista
- auditoria visual
- notificações derivadas
- activity feed derivado
- dashboard básico

Regras:

- ownership obrigatório
- audit obrigatório se houver mutation
- revalidatePath obrigatório em mutation
- typecheck/lint/build obrigatório
- relatório final obrigatório

### 3.3 Nível 3 — Alto risco

Deve ir para Sonnet primeiro.

Exemplos:

- agenda/disponibilidade
- onboarding parceiro automático
- notificações persistidas
- moderação unificada
- edição de solicitações
- edição/exclusão de avaliações
- fluxo de disputa com impacto reputacional
- mudança na experiência de verificação
- conciliação entre admin e portal parceiro
- qualquer coisa que toque tutor + profissional + admin ao mesmo tempo

Regras:

- primeiro auditar código existente
- desenhar plano
- listar arquivos afetados
- listar riscos
- só depois implementar

### 3.4 Nível 4 — Crítico / Engine

Somente Sonnet ou agente forte equivalente.

Exemplos:

- Trust Score Engine
- Ranking Engine
- Recommendation Engine
- Trust Graph Engine
- Antifraude Avançado
- Risk Score
- Service Request State Machine
- pesos reputacionais
- eventos de confiança
- cálculo de recorrência
- regras de penalidade
- impacto de disputa na confiança
- impacto de parceiro na confiança
- detecção de fraude
- migrations estruturais

Regra dura:

> Não implementar mudança de engine sem auditoria prévia, plano escrito, matriz de risco e testes.

---

## 4. Auditoria funcional completa já feita

Foi feita uma auditoria funcional do produto como usuário final, olhando rotas, módulos e fluxos reais do código.

Essa auditoria não alterou código. Ela serviu para identificar lacunas operacionais por ator.

### 4.1 Achados originais por ator

#### Tutor

O loop principal já estava operacional:

- onboarding
- pets
- discovery
- perfil público
- solicitação
- cancelamento
- avaliação
- histórico
- activity

Lacunas encontradas na época:

- redirect pós-solicitação ia para `/requests`, rota do profissional
- disputa sem UI real para tutor/profissional
- editar solicitação após envio ausente
- editar/excluir avaliação ausente
- restaurar pet arquivado ausente
- `/tutor/buscar` stub
- alguns links de activity/dashboard inconsistentes

#### Profissional

A fila de solicitações já estava sólida:

- receber solicitação
- aceitar/rejeitar
- iniciar atendimento
- concluir atendimento
- clientes
- pets atendidos
- avaliações
- métricas
- perfil

Lacunas encontradas na época:

- serviço criado no onboarding, mas sem gestão contínua
- `/professional/agenda` stub
- `/professional/crm` apenas redirect
- services não apareciam direito no perfil
- necessidade de melhorar guards em rotas profissionais

#### Parceiro

O onboarding parceiro era rico, mas havia quebra operacional:

- Partner era criado
- página pública existia
- mas portal dependia de `PartnerProfile.linkedPartnerId`
- vínculo automático não existia
- recomendações só funcionavam no onboarding
- portal não permitia gestão contínua de recomendações
- alguns fluxos exigiam SQL manual para testar

#### Admin

Backoffice amplo, com muitas áreas já operacionais:

- dashboard
- users/tutors/professionals
- requests
- reviews
- trust
- relationships
- growth
- verifications
- badges
- partners
- recommendations
- trust graph
- flags
- disputes
- activity
- audit
- risk

Lacunas encontradas na época:

- rotas dev sem guard admin
- nav legado apontando para stubs
- moderação unificada ausente
- partner verification duplicada entre form e fila
- admin sem UI para vincular user ↔ parceiro
- várias entidades apenas read-only

---

## 5. O que foi resolvido depois da auditoria funcional

Importante para o próximo agente: muitos achados da auditoria original já foram atacados nas etapas 7.1 a 7.5.

### 5.1 Resolvido: gestão contínua de serviços

Etapa 7.1.

Entregue:

- `/professional/services`
- criar serviço
- editar serviço
- ativar/desativar serviço
- audit de criação/edição/ativação/desativação
- serviços inativos somem do perfil público
- preço único corrigido quando `priceMin === priceMax`

### 5.2 Resolvido: gestão contínua de recomendações do parceiro

Etapa 7.2.

Entregue:

- `/partner/recommendations`
- buscar profissional
- adicionar recomendação
- desativar recomendação
- reativar recomendação
- audit de recomendação criada/desativada/ativada
- uso de `TrustConnection`

### 5.3 Parcialmente resolvido: navegação contextual e guards

Etapa 7.3.

Entregue:

- helpers de retorno contextual
- `from=partner`
- `returnTo`
- `/partner/pending`
- guards nas rotas admin dev
- labels de auditoria mais humanos

Ainda há regressão atual:

- links de notificações quebrados
- botão `Perfil público` em `/partner/recommendations` quebrou rota

Antes de avançar, corrigir isso.

### 5.4 Resolvido: disputas MVP

Etapa 7.4.

Entregue:

- tutor abre disputa
- profissional vê banner
- admin gerencia status
- audit registra
- activity inclui disputa

Limitações intencionais:

- disputa não altera `ServiceRequest.status`
- disputa não impacta Trust Score ainda
- sem chat/anexo/mediação
- audit label ainda pode ser melhorado

### 5.5 Resolvido parcialmente: notificações internas

Etapa 7.5.

Entregue:

- rotas por persona
- sino no topo
- contador
- notificações derivadas
- sem schema/migration

Pendente:

- corrigir hrefs das notificações
- corrigir botão de perfil público em partner recommendations
- sem lida/não lida persistido

---

## 6. Pendências ainda herdadas da auditoria funcional

### 6.1 Pendências críticas ou importantes

1. Corrigir links/hrefs da 7.5.
2. Commit/tag da 7.5 após correção.
3. Onboarding parceiro automático:
   - criar/vincular `PartnerProfile`
   - preencher `linkedPartnerId`
   - evitar SQL manual
4. Admin UI para vincular usuário ↔ parceiro.
5. Agenda/disponibilidade.
6. Editar solicitação antes do aceite.
7. Editar/excluir avaliação, com regras claras.
8. Moderação unificada.
9. Persistência de notificações.
10. Melhorar labels de auditoria para entidades como Dispute e TrustConnection.
11. Revisar stubs e navegação legada do admin.
12. Revisar partner verification para evitar bypass manual inconsistente.

### 6.2 Pendências de melhoria

- restaurar pet arquivado
- upload real de avatar/documentos
- admin ver pets
- admin ver evidências de verificação
- ações inline no activity center
- admin risk com ação operacional
- growth editar/excluir território
- badges manuais no admin, se fizer sentido

---

## 7. Auditoria profunda que ainda precisa ser feita com Sonnet

Existe uma auditoria mais importante que ainda deve ser feita antes de mexer nas engines.

Ela não é a auditoria funcional de rotas.

Ela é uma auditoria profunda de confiança e reputação.

Nome sugerido:

```text
AUDITORIA SONNET — Trust, Ranking, Recommendation, Trust Graph e Antifraude
```

### 7.1 Objetivo

Avaliar se as engines atuais realmente representam a tese do produto:

> Confiança contextual, recorrência, validação social e segurança emocional.

E identificar como melhorar sem quebrar o MVP.

### 7.2 O que Sonnet precisa auditar

#### Trust Score / Índice de Confiança

Auditar:

- onde o score é calculado
- quais sinais entram no cálculo
- quais sinais são ignorados
- se há pesos fixos demais
- se há caps/limites
- se há penalidades
- se há recência/decay
- se há proteção contra poucos dados
- se há explicabilidade no admin
- se há diferença entre score público e debug interno
- se o score é recalculado corretamente
- se manual recalculation tem audit
- se `verifiedIdentity` está sendo usado corretamente
- se partner recommendation pesa demais ou pouco
- se disputa deveria pesar agora ou só no futuro

#### Trust Events

Auditar:

- eventos existentes
- eventos duplicados
- eventos ausentes
- taxonomia dos tipos
- consistência de entityType/entityId
- consistência de actorId
- eventos que deveriam existir e não existem
- eventos que existem mas não entram no score

#### Recorrência

Auditar:

- como `TutorProfessionalRelationship` é atualizado
- o que define cliente recorrente
- se recorrência conta por tutor, por pet ou por serviço
- se existe risco de inflar recorrência artificialmente
- se cancelamentos entram negativamente
- se serviços concluídos têm peso contextual

#### Reviews / Avaliações

Auditar:

- média simples vs confiança estatística
- peso de avaliação recente
- peso de comentário negativo
- limite de uma avaliação por serviço
- janela de avaliação
- edição/exclusão futura
- ocultação/moderação
- reviews ocultas devem ou não impactar score
- avaliação mútua futura tutor ↔ profissional

#### Partner Recommendations

Auditar:

- se recomendação de parceiro verificado deve pesar mais
- se parceiro não verificado deve pesar pouco ou zero
- se recomendação desativada deve remover impacto
- se muitas recomendações do mesmo parceiro criam distorção
- se parceiro pode recomendar profissional com relação suspeita
- se recomendação deve ser contextual por bairro/categoria

#### Verification Engine

Auditar:

- diferença entre request de verificação e selo ativo
- suspensão/reativação
- partner verification via fila vs form admin
- risco de bypass
- impacto real da verificação no score
- badge público vs estado interno

#### Disputes

Auditar:

- disputa aberta deve impactar score?
- só disputa resolvida contra profissional deve impactar?
- disputa falsa deve impactar tutor?
- disputa em análise deve só aparecer no risk score?
- como evitar punição injusta
- como registrar eventos sem mudar state machine

#### Fraud Signals / Antifraude

Auditar:

- existência e uso real de `FraudSignal`
- quais sinais são gerados hoje
- quais são só read-only
- onde aparecem no admin
- se risk score usa esses dados
- se flags resolvidas continuam impactando
- como conectar antifraude ao Trust Score sem deixar opaco

#### Ranking Engine

Auditar:

- quais fatores entram no ranking
- se ranking usa Trust Score direto ou breakdown
- se preço influencia indevidamente
- se localização/bairro está pesando
- se profissionais novos têm chance justa
- se verificação/recomendação/recorrência estão calibradas
- se há fallback quando poucos dados existem

#### Recommendation Engine

Auditar:

- recomendações de profissionais no discover
- recomendações por parceiro
- recomendação contextual por pet/bairro/serviço
- risco de bolha ou privilégio indevido
- como explicar por que alguém foi recomendado

#### Trust Graph

Auditar:

- `TrustConnection`
- força da conexão
- conexão partner → professional
- conexão tutor ↔ professional
- conexão admin/manual
- ativação/desativação
- impacto no score/ranking
- visualização pública vs interna

---

## 8. Princípios para melhorar Trust Score no futuro

### 8.1 Trust Score não deve ser só nota média

O Índice de Confiança deve considerar:

- avaliações
- número de serviços concluídos
- recorrência
- cancelamentos
- disputas
- verificação
- recomendações
- histórico com tutores
- sinais de fraude
- consistência de comportamento
- tempo de plataforma
- qualidade dos comentários
- moderação

### 8.2 Poucos dados não podem parecer alta confiança

Um profissional com uma avaliação 5 estrelas não deve parecer mais confiável que outro com 50 atendimentos bons.

Necessário considerar:

- volume
- confiança estatística
- maturidade da reputação
- nível de evidência
- score público com linguagem cuidadosa

Exemplo de linguagem futura:

```text
Confiança inicial
Boa reputação
Muito confiável
Referência local
```

### 8.3 Recorrência deve pesar mais que avaliação isolada

Recorrência é núcleo do produto.

Mas precisa evitar fraude.

Perguntas:

- quantos atendimentos definem recorrência?
- em qual janela de tempo?
- pelo mesmo tutor?
- pelo mesmo pet?
- por tipo de serviço?
- recorrência muito concentrada em uma pessoa deve valer menos?

### 8.4 Parceiro ajuda, mas não compra confiança

Recomendação de parceiro é importante.

Mas não pode virar compra de reputação.

Regras futuras possíveis:

- parceiro verificado pesa mais
- parceiro recém-criado pesa pouco
- recomendação desativada perde impacto
- recomendação suspeita vira sinal de risco
- múltiplas recomendações precisam de diversidade

### 8.5 Disputas devem ser justas

Disputa aberta não deve destruir score automaticamente.

Possível lógica futura:

```text
OPEN → não penaliza score público; aumenta atenção operacional.
UNDER_REVIEW → aparece no risk/admin, não necessariamente público.
RESOLVED contra profissional → penaliza.
RESOLVED contra tutor ou improcedente → não penaliza profissional.
Muitas disputas abertas → sinal de risco leve.
```

### 8.6 Antifraude deve proteger, não punir cegamente

O antifraude deve detectar padrões, não tomar decisões opacas sozinho.

Exemplos de sinais:

- muitas avaliações em pouco tempo
- avaliações repetidas entre mesmos usuários
- recorrência artificial
- parceiro recomendando muitos profissionais suspeitos
- cancelamentos em massa
- disputa repetida
- review negativa ocultada sem justificativa
- profissional tentando manipular serviços/preços

### 8.7 Score precisa ser explicável

Admin precisa ver:

- score final
- breakdown
- eventos positivos
- eventos negativos
- sinais ignorados
- caps aplicados
- histórico de recalculação
- por que o nível mudou

Usuário público precisa ver linguagem simples, não fórmula.

---

## 9. Fases futuras recomendadas para Trust/Engines

### Fase A — Auditoria sem alteração

Usar Sonnet.

Objetivo:

- mapear código real
- mapear entidades
- mapear eventos
- mapear pesos
- mapear telas que consomem score
- mapear bugs e inconsistências

Não alterar código.

### Fase B — Documentação da engine atual

Criar documento:

```text
TRUST_ENGINE_CURRENT_STATE.md
```

Deve conter:

- entradas
- saídas
- pesos
- eventos
- limitações
- riscos
- pontos cegos

### Fase C — Proposta de Trust Score v2

Criar documento:

```text
TRUST_ENGINE_V2_PROPOSAL.md
```

Deve conter:

- nova taxonomia de sinais
- pesos sugeridos
- caps
- decay
- penalidades
- anti-gaming
- impacto em telas
- impacto em admin
- testes
- plano de migração, se necessário

### Fase D — Implementação incremental

Nunca implementar tudo de uma vez.

Ordem sugerida:

1. melhorar debug/breakdown sem mudar score público
2. padronizar TrustEvent types
3. adicionar testes/calculadora admin
4. ajustar pesos leves
5. incluir antifraude como read-only/risk
6. só depois conectar sinais fortes ao score

### Fase E — Ranking/Recommendation calibrados

Depois que Trust Score estiver confiável:

- ranking pode usar score com contexto
- recommendation pode usar trust graph + bairro + histórico
- antifraude pode limitar abusos

---

## 10. Prompt recomendado para Sonnet — Auditoria de Trust/Engines

Copiar e usar quando for iniciar essa frente.

```text
Você está assumindo a auditoria profunda das engines de confiança do Peteen.

Leia primeiro:
- PETEEN_MASTER_CONTEXT_v2.md
- PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md

Contexto:
Peteen não é marketplace genérico. É uma rede confiável de pessoas e parceiros para cuidar de pets. A tese central é confiança contextual, recorrência, segurança emocional, reputação real e validação social.

Objetivo desta tarefa:
Fazer uma auditoria profunda, SEM ALTERAR CÓDIGO, dos módulos relacionados a:
- Trust Score / Índice de Confiança
- Trust Events
- Trust Graph
- Ranking Engine
- Recommendation Engine
- Recorrência
- Avaliações
- Verificações
- Disputas
- Fraud Signals / Antifraude
- Risk Score

IMPORTANTE:
Não implementar nada agora.
Não alterar schema.
Não criar migration.
Não alterar pesos.
Não alterar engines.
Não refatorar.
Apenas auditar, mapear e propor.

Você deve investigar no código:
1. Onde o Trust Score é calculado.
2. Quais entidades alimentam o score.
3. Quais eventos de confiança existem.
4. Quais eventos são criados por reviews, services, verification, partner recommendation, disputes e admin actions.
5. Quais sinais existem no banco mas não entram no score.
6. Como recurrence/relationship é calculada.
7. Como TrustConnection é usada.
8. Como Ranking Engine consome ou não consome score.
9. Como Recommendation Engine consome ou não consome trust graph.
10. Como FraudSignal/Risk Score existem hoje e onde aparecem.
11. Onde há risco de manipulação.
12. Onde há risco de injustiça para profissional novo.
13. Onde há risco de parceiro comprar reputação.
14. Onde há risco de disputa penalizar injustamente.
15. Onde há inconsistência entre score público e admin/debug.

Retorne um relatório com:

A. Mapa dos arquivos lidos.
B. Mapa das entidades envolvidas.
C. Fluxo atual de cálculo do Trust Score.
D. Tabela de sinais positivos, negativos e neutros.
E. Tabela de eventos existentes e ausentes.
F. Pontos de risco/fraude.
G. Pontos de injustiça/reputação frágil.
H. O que NÃO deve ser alterado agora.
I. Proposta de Trust Score v2.
J. Proposta de Antifraude Avançado.
K. Proposta de Ranking/Recommendation calibrados.
L. Ordem incremental de implementação.
M. Testes necessários.
N. Riscos técnicos.
O. Se precisa ou não de migration.

Critérios:
- preservar a tese do produto
- confiança difícil de ganhar, fácil de perder, impossível de comprar
- recorrência pesa mais que estrela isolada
- parceiro ajuda, mas não compra confiança
- disputa precisa ser justa
- score precisa ser explicável
- ranking não prioriza preço
- não quebrar MVP atual
```

---

## 11. Prompt recomendado para Composer Fast — depois da auditoria Sonnet

Usar apenas para executar uma parte pequena já aprovada.

Modelo:

```text
Vamos executar apenas a subetapa [NOME] aprovada na auditoria Sonnet.

Escopo fechado:
[descrever exatamente o que deve mudar]

Não alterar:
- schema
- outras engines
- state machine
- rotas fora do escopo
- pesos fora do escopo

Arquivos prováveis:
[listar arquivos]

Regras:
- manter ownership
- manter auditoria quando houver mutation
- manter revalidatePath
- manter UX humana
- rodar typecheck/lint/build

Retornar:
- arquivos alterados
- antes/depois
- testes feitos
- limitações
```

---

## 12. Roadmap recomendado atualizado

### Imediato

```text
7.5.1 — Corrigir links/hrefs das notificações e partner recommendations
7.5.2 — Retestar todas as notificações
7.5.3 — Commit/tag v0.7.5
```

### Próximas frentes operacionais

```text
7.6 — Agenda e Disponibilidade MVP                  → Sonnet primeiro
7.7 — Onboarding parceiro + vínculo automático       → Sonnet primeiro
7.8 — UI/admin polish de disputas e audit labels      → Composer Fast ou Sonnet leve
7.9 — Notificações persistidas                        → Sonnet primeiro
7.10 — Moderação unificada                            → Sonnet primeiro
```

### Frentes de engine

```text
8.0 — Auditoria Sonnet de Trust/Engines               → Sonnet, sem código
8.1 — Trust Engine Current State Doc                  → Sonnet
8.2 — Trust Score v2 Proposal                         → Sonnet
8.3 — Implementação incremental de Trust Debug        → Composer Fast com plano
8.4 — Antifraude Avançado read-only                   → Sonnet + Composer
8.5 — Ranking/Recommendation calibration              → Sonnet
8.6 — Trust Graph avançado                            → Sonnet
```

---

## 13. Regras duras para qualquer agente futuro

1. Não tratar Peteen como marketplace.
2. Não priorizar preço no ranking.
3. Não fazer tutor pagar no MVP.
4. Não transformar WhatsApp no núcleo da operação.
5. Não criar migration sem autorização explícita.
6. Não alterar Trust Engine sem auditoria prévia.
7. Não alterar Ranking Engine sem auditoria prévia.
8. Não alterar Recommendation Engine sem auditoria prévia.
9. Não alterar Service Request State Machine sem plano Sonnet.
10. Não usar Partner Recommendation como reputação comprável.
11. Não penalizar disputa aberta automaticamente.
12. Não mostrar badge público que não tenha fluxo real por trás.
13. Não duplicar módulos existentes.
14. Não ignorar ownership.
15. Não criar audit ao visualizar páginas.
16. Não criar ação sem revalidatePath quando necessário.
17. Não deixar rota admin sensível sem requireAdmin.
18. Não confundir onboarding com gestão contínua.
19. Não confundir Activity Center com Notifications.
20. Sempre rodar typecheck, lint e build.

---

## 14. Mensagem final para o próximo agente

Você está entrando em um produto que já tem uma base forte.

Não comece refazendo.

Primeiro leia, entenda, audite e preserve.

O Peteen está em fase de consolidar o MVP operacional. A prioridade imediata é corrigir links da etapa 7.5 e fechar a versão. Depois disso, as próximas frentes devem ser tratadas com mais cuidado porque atravessam regras centrais de confiança.

O maior risco daqui para frente não é faltar código.

O maior risco é um agente rápido mexer em uma engine sensível sem entender a tese do produto.

A tese é simples:

> Peteen vende confiança, não serviço barato.

Toda decisão técnica precisa proteger isso.
