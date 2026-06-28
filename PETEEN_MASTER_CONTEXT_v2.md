# PETEEN — MASTER CONTEXT v2

**Versão:** v2  
**Data:** 2026-06-27  
**Projeto:** Peteen  
**Objetivo deste documento:** permitir que outro agente continue o desenvolvimento do Peteen sem perder contexto, decisões de produto, arquitetura, etapas concluídas, aprendizados, bugs conhecidos e próximos passos.

> Este documento é a fonte de verdade operacional do projeto neste momento.  
> Ele não substitui o código, mas explica o raciocínio, as decisões e o estado atual do produto.

---

## 0. Resumo executivo para o próximo agente

Peteen é uma plataforma SaaS/rede de confiança para cuidados pet.

O produto **não deve ser tratado como marketplace genérico**.  
A tese central é:

> Peteen é uma rede confiável de pessoas e parceiros para cuidar de pets, baseada em confiança contextual, recorrência, reputação e segurança emocional.

O sistema conecta:

- Tutores
- Profissionais pet
- Parceiros
- Administradores

O foco não é preço, volume ou leilão de serviços.  
O foco é confiança, recorrência, histórico real e validação social.

A plataforma já possui:

- Auth
- Onboarding
- Portal do tutor
- Portal do profissional
- Portal do parceiro
- Portal admin
- Pets
- Solicitações de serviço
- Avaliações
- Histórico de relacionamento
- Índice de Confiança
- Badges de reputação
- Verificação
- Rede de Confiança
- Recomendações de parceiros
- Atividades
- Notificações internas MVP
- Disputas MVP
- Serviços do profissional
- Gestão de recomendações do parceiro
- Auditoria

Estado atual aproximado:

```text
MVP funcional: ~85% a 90%
Produto operacional: alto
Pronto para testes internos: quase
Pronto para usuários externos: ainda precisa corrigir bugs de links/notificações e revisar fluxos finais
```

---

## 1. Filosofia do produto

### 1.1 Peteen não é marketplace

Peteen não deve parecer:

- OLX de pets
- catálogo de cuidadores
- Uber de pet sitter
- diretório de profissionais
- marketplace de menor preço

Peteen deve parecer:

> uma rede premium de confiança para cuidados pet.

### 1.2 Princípios centrais

1. **Confiança é o produto**
2. **Recorrência vale mais que avaliação isolada**
3. **Reputação deve ser contextual**
4. **Parceiros confiáveis aumentam segurança da rede**
5. **WhatsApp é canal auxiliar, não núcleo do produto**
6. **Solicitação nasce dentro da plataforma**
7. **Profissional define seu próprio preço**
8. **Tutor não paga para usar**
9. **Ranking não prioriza menor preço**
10. **Confiança deve ser difícil de ganhar, fácil de perder e impossível de comprar**

### 1.3 Linguagem humana

Foi decidido na etapa de UX que a interface não deve usar termos técnicos em inglês.

Preferências de nomenclatura:

| Técnico | Interface |
|---|---|
| Trust Score | Índice de Confiança / Confiança |
| Trust Level | Nível de Confiança |
| Trust Graph | Rede de Confiança |
| Trust Connections | Conexões de Confiança |
| Reviews | Avaliações |
| Activity Center | Atividades |
| Relationship History | Histórico de Relacionamento |
| Partner Portal | Portal do Parceiro |
| Professional Profile | Perfil Profissional |
| Recommendations | Recomendações |

O código pode continuar técnico. A interface deve falar a língua do usuário.

---

## 2. Atores do sistema

### 2.1 Tutor

Pessoa que busca alguém confiável para cuidar do pet.

Pode:

- criar perfil
- cadastrar pets
- buscar profissionais
- solicitar serviço
- acompanhar solicitação
- cancelar quando permitido
- avaliar serviço concluído
- abrir disputa
- ver histórico com profissionais
- ver notificações
- ver atividades

### 2.2 Profissional

Pessoa prestadora de serviço pet.

Inclui:

- cuidador
- pet sitter
- passeador
- hospedagem
- adestrador
- especialista comportamental

Pode:

- criar perfil profissional
- cadastrar serviços no onboarding
- gerenciar serviços depois do onboarding
- aceitar/rejeitar solicitações
- iniciar/concluir atendimento
- acompanhar clientes
- ver pets atendidos
- ver avaliações recebidas
- solicitar verificação
- ver Índice de Confiança
- ver atividades
- ver notificações
- visualizar disputas relacionadas

### 2.3 Parceiro

Organização que reforça a rede de confiança.

Exemplos:

- pet shop
- clínica veterinária
- ONG
- hotel pet
- creche pet
- parceiro local

Pode:

- ter página pública
- ser verificado
- recomendar profissionais
- gerenciar recomendações no portal
- ver métricas
- editar perfil
- ver atividades
- ver notificações

### 2.4 Admin

Equipe Peteen.

Pode:

- acompanhar usuários
- acompanhar profissionais
- acompanhar tutores
- acompanhar parceiros
- aprovar/rejeitar verificações
- suspender/reativar selo
- ver auditoria
- ver atividades globais
- gerenciar disputas
- recalcular Índice de Confiança
- visualizar debug de confiança
- moderar avaliações/flags/disputas

---

## 3. Stack e arquitetura

### 3.1 Stack principal

- Next.js 15 App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Supabase Auth
- Supabase Postgres
- Prisma
- RSC para fetch/renderização principal
- Server Actions para mutações
- Arquitetura modular por domínio

### 3.2 Estrutura modular

Padrão usado:

```text
modules/<dominio>/
├── domain/
├── application/
├── infrastructure/
├── components/
└── index.ts quando necessário
```

Regras:

- `domain`: tipos, constantes, regras puras
- `application`: actions, guards, casos de uso
- `infrastructure`: Prisma queries/repositories/audit
- `components`: UI do domínio
- Server Actions devem ficar isoladas
- Client Components não devem importar Prisma, queries server ou módulos com `"use server"`

### 3.3 Regras importantes

Nunca alterar sem motivo forte:

- Trust Engine
- Ranking Engine
- Recommendation Engine
- Verification Engine
- Trust Graph
- Service Request State Machine
- Prisma Schema
- Growth Engine

Sempre que mexer em rotas sensíveis:

- validar ownership
- validar persona
- validar auditoria
- rodar typecheck/lint/build

---

## 4. Comandos recorrentes

### 4.1 Rodar dev

```powershell
cd "C:\Users\55119\Documents\PROJETO PET\apps\web"
npm run dev
```

### 4.2 Validar build

```powershell
npm run typecheck
npm run lint
npm run build
```

### 4.3 Prisma / banco

```powershell
npm run db:push
npx prisma generate
```

### 4.4 Testar conexão Prisma

```powershell
npx prisma db pull
```

### 4.5 Problema recorrente: cache Next quebrado

O projeto frequentemente apresenta erros como:

```text
Cannot find module './5611.js'
Cannot find module './1331.js'
__webpack_modules__[moduleId] is not a function
CSS sumiu
Cannot find middleware module
ChunkLoadError
```

Na maioria das vezes é cache `.next` corrompido.

Procedimento seguro:

```powershell
Ctrl + C

Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,3001,3002,3003 } | Select-Object LocalPort,OwningProcess

Stop-Process -Id NUMERO_REAL -Force

cd "C:\Users\55119\Documents\PROJETO PET\apps\web"

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

npm run dev
```

Regra crítica:

> Nunca apagar `.next` com `npm run dev` rodando.

---

## 5. Ambientes e Supabase

Projeto Supabase:

```text
hxzlrfyelxmybghtbbxh
```

Arquivos relevantes:

```text
apps/web/.env
apps/web/.env.local
```

Atenção:

- Next lê `.env.local`
- Prisma CLI com `dotenv/config` lê `.env`
- As variáveis `DATABASE_URL` e `DIRECT_URL` precisam estar corretas nos dois arquivos
- Se mudar senha do banco no Supabase, atualizar os dois arquivos

Variáveis importantes:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY= ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=
```

Cuidado com senha em URL:

- Se tiver caracteres especiais, precisa URL-encode.
- Evitar temporariamente `@ # % / ? & : [ ] espaço` em senha de teste.

---

## 6. Banco e entidades principais

Tabelas/entidades principais existentes:

- User
- TutorProfile
- ProfessionalProfile
- Partner
- PartnerProfile
- AdminProfile
- Pet
- Service
- ServiceRequest
- Review
- TrustEvent
- TrustConnection
- TutorProfessionalRelationship
- VerificationRequest
- AuditLog
- AdminAuditLog
- Dispute
- FraudSignal
- CrmClient

Pontos importantes:

- Tabelas reais no Postgres usam snake_case por causa de `@@map`.
- Prisma models podem ter nomes em PascalCase.
- Em `$queryRaw`, usar nomes reais das tabelas, não nomes dos models.
- `Service` é catálogo de serviços do profissional.
- `ServiceRequest` representa solicitação concreta.
- `TrustConnection` representa conexão/recomendação de confiança.
- `TutorProfessionalRelationship` representa relacionamento e recorrência.
- `Dispute` já existia no schema e foi usado na etapa 7.4 sem migration.

---

## 7. Fluxo principal do produto

### 7.1 Fluxo tutor

```text
Login
→ Onboarding Tutor
→ Cadastrar pet
→ Buscar profissional
→ Ver perfil público
→ Solicitar serviço
→ Acompanhar solicitação
→ Serviço concluído
→ Avaliar
→ Relacionamento/recorrência
→ Histórico
→ Notificações/atividades
```

### 7.2 Fluxo profissional

```text
Login
→ Onboarding Profissional
→ Cadastrar serviço inicial
→ Gerenciar serviços
→ Receber solicitação
→ Aceitar/Rejeitar
→ Iniciar atendimento
→ Concluir atendimento
→ Receber avaliação
→ Ganhar confiança/recorrência
→ Ver clientes e histórico
```

### 7.3 Fluxo parceiro

```text
Onboarding/conta parceira
→ Vincular PartnerProfile a Partner
→ Portal parceiro
→ Ver recomendações
→ Adicionar recomendação
→ Desativar/Reativar recomendação
→ Ver métricas
→ Ver atividades/notificações
```

### 7.4 Fluxo admin

```text
Login Admin
→ Dashboard
→ Verificações
→ Disputas
→ Auditoria
→ Confiança
→ Parceiros
→ Moderação
→ Atividades/Notificações
```

---

## 8. Etapas implementadas e estado

### 8.1 Fundações anteriores

Já foram implementadas:

- Auth
- Supabase Foundation
- Prisma
- RLS/buckets
- Módulos base
- Service Request State Machine
- Reviews
- Trust Engine
- Verification Engine
- Trust Graph
- Ranking/Recommendation foundations
- Growth foundations
- Admin backoffice parcial

### 8.2 Etapa 6.3 — Pet Management

Status: validada.

Entregou:

- `/me/pets`
- `/me/pets/new`
- `/me/pets/[id]`
- CRUD pet
- arquivamento via `isActive=false`
- dashboard tutor com pets
- auditoria `pet.created`, `pet.updated`, `pet.archived`

Observação:

- Pet arquivado some da listagem mas permanece no banco.
- Restaurar pet arquivado ainda é melhoria futura.

### 8.3 Etapa 6.4 — Tutor Portal

Status: validada.

Entregou:

- `/tutor`
- `/tutor/requests`
- `/tutor/requests/[requestId]`
- `/tutor/perfil`
- dashboard tutor
- atividade recente
- profissionais contratados
- perfil editável
- solicitações dedicadas do tutor

Correção importante:

- Links de solicitação do tutor foram corrigidos para `/tutor/requests/[id]`.
- Antes caíam na rota profissional `/requests/[id]`.

### 8.4 Etapa 6.5 — Professional Portal & CRM

Status: validada.

Entregou:

- `/professional`
- `/professional/clients`
- `/professional/pets`
- `/professional/reviews`
- `/professional/metricas`
- CRM foundation
- clientes agrupados
- pets atendidos
- avaliações recebidas
- métricas profissionais

### 8.5 Etapa 6.5.1 — Professional Profile Management

Status: validada.

Entregou:

- `/professional/profile`
- edição do perfil profissional
- avatar URL
- cidade, bairro, telefone, bio
- tipos de serviço e especializações
- auditoria `professional.profile_updated`
- redirect tutor → `/tutor`

### 8.6 Etapa 6.6 — Relationship & History Layer

Status: validada.

Entregou:

- `modules/relationship-history`
- `/professional/clients/[tutorId]`
- `/tutor/professionals/[professionalId]`
- timeline de relacionamento
- pets relacionados
- reviews
- solicitações
- recorrência

### 8.7 Etapa 6.7 — Badges & Reputation Visualization

Status: validada e commitada.

Entregou:

- `modules/reputation-badges`
- badges:
  - Verificado
  - Recomendado
  - Cliente Recorrente
  - Experiente
  - Bem Avaliado
- resumo reputacional
- badges no Discovery, perfil público, histórico tutor, portal profissional

Ajuste importante:

- Badge legado `Documento Verificado` foi marcado como `internalOnly`.
- Não aparece publicamente até existir fluxo documental real.
- `verifiedIdentity` continua existindo internamente para Índice de Confiança.

### 8.8 Etapa 6.8 — Partner Portal Foundation

Status: validada e commitada.

Entregou:

- `/partner`
- `/partner/recommendations`
- `/partner/metrics`
- `/partner/profile`
- `/partner/pending`
- `modules/partner-portal`
- ownership via `PartnerProfile.linkedPartnerId`
- auditoria `partner.profile_updated`
- navegação contextual com `from=partner` e `returnTo`

Ponto sensível:

- Para testar parceiro, precisa de `PartnerProfile` vinculado a `Partner`.
- Foi usado usuário de teste `testeparceiro@gmail.com` vinculado à Love Pet.
- O vínculo automático no onboarding ainda não foi implementado.

### 8.9 Etapa 6.9 — Activity Center

Status: validada.

Entregou:

- `/tutor/activity`
- `/professional/activity`
- `/partner/activity`
- `/admin/activity`
- `modules/activity-center`
- feeds derivados de dados existentes
- sem schema novo
- sem auditoria ao visualizar

Diferença:

- Activity Center = histórico do que aconteceu
- Notifications = itens que pedem atenção

### 8.10 Etapa 7.0 — UX Polish / Humanização

Status: aplicada.

Entregou:

- troca de nomenclaturas técnicas por linguagem humana:
  - Trust Score → Índice de Confiança
  - Trust Graph → Rede de Confiança
  - Reviews → Avaliações
  - Activity Center → Atividades
  - Risk Score → Índice de Risco
- Padronização de textos em admin e portais
- Sem alterar código interno/tabelas/engines

### 8.11 Etapa 7.1 — Meus Serviços

Status: validada.

Entregou:

- `/professional/services`
- `modules/professional-services`
- listar serviços
- criar serviço
- editar serviço
- ativar/desativar
- auditoria:
  - `professional.service_created`
  - `professional.service_updated`
  - `professional.service_activated`
  - `professional.service_deactivated`
- bloco no perfil profissional com total de serviços
- serviços inativos somem do perfil público

Decisão:

- Não deletar serviço fisicamente.
- Usar desativar/ativar.
- Isso preserva histórico.

Ajuste feito:

- Quando `priceMin === priceMax`, exibir preço único, não range `R$ 202–202`.

### 8.12 Etapa 7.2 — Gestão de Recomendações do Parceiro

Status: validada e commitada.

Entregou:

- gerenciamento em `/partner/recommendations`
- buscar profissional
- adicionar recomendação
- desativar recomendação
- reativar recomendação
- auditoria:
  - `partner.recommendation_created`
  - `partner.recommendation_deactivated`
  - `partner.recommendation_activated`
- usa `TrustConnection`
- não altera Trust Engine, Ranking ou Recommendation Engine

Ponto observado:

- Admin audit pode mostrar ID da TrustConnection. Melhorar label visual futuramente.

### 8.13 Etapa 7.3 — Correções Estruturais Críticas

Status: implementada e testada majoritariamente.

Entregou:

- contexto de navegação:
  - `from`
  - `returnTo`
  - `Voltar ao portal parceiro`
- `/partner/pending`
- guards em rotas admin dev:
  - `/admin/trust-debug`
  - `/admin/trust-recalculate`
- labels de audit mais humanos
- empty states e textos revisados
- navegação revisada

Ponto observado:

- Quando parceiro entra em perfil público do profissional, a rota é `/discover/[id]`, então o menu pode parecer de Discovery/Tutor, mas o botão voltar retorna ao portal parceiro. Isso foi aceito como funcional para agora.

### 8.14 Etapa 7.4 — Disputas MVP

Status: implementada e testada no fluxo principal.

Entregou:

- `modules/disputes`
- botão `Reportar problema` em `/tutor/requests/[requestId]`
- profissional vê banner em `/requests/[id]`
- admin gerencia em `/admin/disputes`
- status:
  - Aberta
  - Em análise
  - Resolvida
- auditoria:
  - `dispute.created`
  - `dispute.status_updated`
- Activity Center atualizado para disputas
- sem alterar ServiceRequest State Machine
- sem alterar Índice de Confiança

Observações:

- Não há notificação real nesta etapa; isso veio na 7.5.
- Audit ainda pode ter label genérico da entidade Dispute.
- Status do ServiceRequest não muda para `DISPUTED`. Foi decisão MVP: disputa é registro separado.

### 8.15 Etapa 7.5 — Notificações Internas MVP

Status: implementada, mas ainda com bug pendente.

Entregou:

- `modules/notifications`
- `/tutor/notifications`
- `/professional/notifications`
- `/partner/notifications`
- `/admin/notifications`
- sino no TopBar/AdminShell
- contador
- notificações derivadas, sem tabela
- sem lida/não lida persistido
- sem e-mail, push, WhatsApp, websocket

Ponto crítico pendente:

> Alguns links/hrefs das notificações estão quebrados ou levando para rotas erradas.

Também observado:

> Em `/partner/recommendations`, botão `Perfil público` quebrou caminho após ajustes de navegação/notificação.

Antes de commit da 7.5, corrigir bugs de href.

---

## 9. Estado atual exato

Último ponto da conversa:

- 7.5 implementada
- testes gerais de notificações passaram parcialmente
- foram encontrados bugs de links:
  - notificações levam para caminhos errados
  - botão Perfil público em `/partner/recommendations` quebrou caminho
- Ainda não fazer commit da 7.5 enquanto esse bug existir

Próxima tarefa imediata:

```text
BUG 7.5 / Regressão 7.3 — corrigir links quebrados de navegação e notificações
```

---

## 10. Bug atual para novo agente corrigir

### 10.1 Problema

Após etapa 7.5, alguns links estão quebrados:

1. Algumas notificações levam para rotas erradas ou inexistentes.
2. Em `/partner/recommendations`, botão `Perfil público` do profissional recomendado quebrou o caminho.
3. A única notificação que parecia funcionar corretamente era a de disputa.

### 10.2 Suspeita

O bug provavelmente está em:

- helpers de navegação contextual
- montagem de hrefs com `from` e `returnTo`
- `buildDiscoverUrl`
- `resolvePublicPageBackLink`
- notification queries/hrefs
- links para `/discover/[professionalId]`
- links para `/partners/[slug]`
- uso incorreto de `encodeURIComponent`
- URL relativa quebrada
- `undefined`
- `[object Object]`
- path duplicado

### 10.3 Regras de destino

Tutor:

```text
solicitação criada/aceita/concluída → /tutor/requests/[requestId]
avaliação pendente → /tutor/requests/[requestId]
disputa criada/status alterado → /tutor/requests/[requestId]
profissional relacionado → /tutor/professionals/[professionalId]
fallback → /tutor/notifications
```

Profissional:

```text
nova solicitação → /requests/[requestId]
solicitação cancelada/concluída → /requests/[requestId]
avaliação recebida → /professional/reviews
disputa aberta → /requests/[requestId]
cliente recorrente → /professional/clients/[tutorId]
recomendação recebida → /professional/metricas ou /professional/activity
fallback → /professional/notifications
```

Parceiro:

```text
recomendação criada/ativada/desativada → /partner/recommendations
profissional indicado recebeu avaliação → /discover/[professionalId]?from=partner&returnTo=/partner/notifications
profissional indicado tornou-se recorrente → /partner/metrics ou /partner/recommendations
verificação do parceiro → /partner/profile
fallback → /partner/notifications
```

Admin:

```text
disputa aberta → /admin/disputes
verificação pendente → /admin/verifications
avaliação/moderação → /admin/reviews
flag/risk → /admin/flags
parceiro sem vínculo → /admin/partners
auditoria relacionada → /admin/audit
fallback → /admin/notifications
```

### 10.4 Link correto em Partner Recommendations

```text
/partner/recommendations
→ Perfil público de profissional
→ /discover/[professionalId]?from=partner&returnTo=/partner/recommendations
```

Na página pública:

```text
Voltar ao portal parceiro
→ /partner/recommendations
```

### 10.5 Não fazer

Não alterar:

- schema
- engines
- Trust
- Ranking
- Recommendation
- Verification
- Activity Center
- Disputes

Corrigir somente hrefs/links.

---

## 11. Bugs e aprendizados importantes

### 11.1 Cache Next

Problema recorrente.

Sintomas:

```text
Cannot find module './5611.js'
Cannot find module './1331.js'
__webpack_modules__[moduleId] is not a function
CSS sumiu
Cannot find middleware module
ChunkLoadError
```

Solução:

```powershell
Ctrl + C

Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,3001,3002,3003 } | Select-Object LocalPort,OwningProcess

Stop-Process -Id NUMERO_REAL -Force

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

npm run dev
```

### 11.2 Prisma / Supabase senha

Se aparecer:

```text
Authentication failed against database server
```

verificar:

- `.env`
- `.env.local`
- `DATABASE_URL`
- `DIRECT_URL`
- senha atual do Supabase

Prisma CLI lê `.env`.  
Next pode ler `.env.local`.

### 11.3 Não confundir onboarding com gestão

Aprendizado forte.

Exemplos:

- serviço no onboarding não significa Meus Serviços
- recomendação no onboarding não significa gestão de recomendações
- parceiro criado não significa PartnerProfile vinculado

Sempre perguntar:

```text
O usuário consegue gerenciar isso depois?
```

### 11.4 Audit labels

Muitos eventos são gravados corretamente, mas a UI do admin pode exibir apenas IDs.  
Melhorar labels é UX/admin polish, não bloqueador.

---

## 12. Roadmap recomendado a partir daqui

### Imediato

1. Corrigir bug de links da 7.5
2. Retestar notificações por persona
3. Validar `/partner/recommendations → Perfil público`
4. Commit/tag da 7.5

### Depois

#### 7.6 — Agenda e Disponibilidade

Recomendado usar Sonnet.

Motivo:

- toca serviços
- solicitações
- profissional
- disponibilidade
- agenda
- talvez bloqueios de horário

#### 7.7 — Onboarding parceiro/vínculo automático

Resolver:

- PartnerProfile automático
- linkedPartnerId
- evitar SQL manual
- fluxo de onboarding parceiro completo

#### 7.8 — UI de disputa mais clara

Melhorar:

- aviso
- status
- timeline
- notificação integrada
- labels no audit

#### 8.0 — Beta MVP

Antes de usuários externos:

- teste ponta a ponta
- seed demo
- revisar env
- revisar RLS
- revisar logs
- revisar permissões admin
- revisar responsividade
- revisar performance

---

## 13. Uso recomendado de Composer Fast vs Sonnet

### Composer Fast pode continuar em:

- correções de link/href
- labels
- UX simples
- empty states
- CRUD simples
- formulários
- listagens
- auditoria visual
- bugs pontuais
- responsividade

### Sonnet recomendado para:

- agenda/disponibilidade
- notificações persistidas
- ranking/recommendation real
- trust graph avançado
- antifraude
- conciliação de estados
- onboarding parceiro automático
- alterações com múltiplos domínios
- mudanças em máquina de estados

Regra prática:

```text
Se for tela/CRUD/listagem → Composer Fast
Se atravessa 3+ módulos ou mexe em regra → Sonnet
```

---

## 14. Checklist obrigatório para todo agente

Antes de implementar:

1. Entender o módulo existente
2. Reutilizar estruturas
3. Não criar duplicidade
4. Não criar migration sem necessidade
5. Não alterar engine sem autorização
6. Garantir ownership
7. Garantir auditoria quando houver mutation
8. Garantir revalidatePath
9. Garantir UX clara
10. Retornar relatório

Depois de implementar:

```bash
npm run typecheck
npm run lint
npm run build
```

Relatório obrigatório:

- arquivos criados
- arquivos alterados
- rotas criadas/alteradas
- ações adicionadas
- ownership aplicado
- auditoria adicionada
- validações executadas
- limitações conhecidas
- testes manuais recomendados

---

## 15. Decisões de produto já tomadas

### Tutor grátis

Tutor não deve pagar para usar.

### Profissional Free e Pro

Modelo planejado:

- Profissional Free: grátis
- Profissional Pro: R$29,90/mês

Benefícios possíveis:

- selo verificado
- agenda
- analytics
- CRM pet
- métricas de recorrência

### Destaque Local

R$19,90/mês para profissionais elegíveis.

### Parceiros

R$99 a R$299/mês.

### Take rate

Zero no MVP.

### Ranking

Não priorizar menor preço.

### Preço

Profissional define seus preços.

### WhatsApp

Camada de comunicação, não núcleo.

---

## 16. Design e UX

Direção visual:

- premium
- humano
- acolhedor
- confiança
- dark mode forte
- cards limpos
- badges pequenos
- linguagem simples
- menos termos técnicos

Referências:

- Airbnb
- Stripe
- Linear
- Notion
- Headspace
- Rover

Paleta conceitual:

- azul confiança
- verde confiança
- cinzas neutros
- off-white para áreas claras
- dark mode como experiência primária

Badges públicos:

- Verificado
- Recomendado
- Cliente Recorrente
- Experiente
- Bem Avaliado

Não usar publicamente até existir fluxo real:

- Documento Verificado

---

## 17. Rotas principais atuais

### Tutor

```text
/tutor
/tutor/requests
/tutor/requests/[requestId]
/tutor/perfil
/tutor/activity
/tutor/notifications
/tutor/professionals/[professionalId]
/me/pets
/me/pets/new
/me/pets/[id]
/discover
/discover/[professionalId]
```

### Profissional

```text
/professional
/professional/services
/professional/clients
/professional/clients/[tutorId]
/professional/pets
/professional/reviews
/professional/metricas
/professional/profile
/professional/activity
/professional/notifications
/requests
/requests/[id]
```

### Parceiro

```text
/partner
/partner/recommendations
/partner/metrics
/partner/profile
/partner/activity
/partner/notifications
/partner/pending
/partners/[slug]
```

### Admin

```text
/admin
/admin/activity
/admin/notifications
/admin/audit
/admin/disputes
/admin/verifications
/admin/badges
/admin/trust
/admin/trust-debug/[professionalId]
/admin/trust-recalculate
/admin/partners
/admin/partners/[id]
/admin/reviews
/admin/flags
/admin/risk
/admin/growth
/admin/relationships
/admin/recommendations
/admin/professionals
/admin/tutors
/admin/users
/admin/requests
```

---

## 18. Estado de validação recente

### 7.1 Meus Serviços

Validado:

- criou serviço
- editou
- desativou
- sumiu do perfil público
- reativou
- voltou no público
- audit registrado
- preço único corrigido

### 7.2 Recomendações do Parceiro

Validado:

- busca profissional
- adiciona recomendação
- números atualizam
- badge recomendado ativa/desativa/reativa
- audit funciona
- ownership presumido pelo guard

### 7.3 Correções Estruturais

Testado:

- parceiro com vínculo abre portal
- parceiro → perfil público → volta corretamente
- tutor/profissional bloqueios principais
- guards admin dev adicionados
- audit labels melhorados

### 7.4 Disputas

Validado:

- tutor abriu disputa
- profissional viu banner
- admin viu e mudou status
- audit registrou
- sem notificação direta nesta etapa

### 7.5 Notificações

Implementado, mas pendente:

- rotas existem
- sino existe
- contador existe
- notifications aparecem
- bug: alguns links levam para rotas erradas
- bug: `/partner/recommendations` botão Perfil público quebrou após navegação

---

## 19. Próximo prompt recomendado

Usar no novo agente:

```text
BUG 7.5 / Regressão 7.3 — Links quebrados de navegação e notificações

Problemas:
1. Algumas notificações levam para rotas erradas ou quebradas.
2. Em /partner/recommendations, o botão "Perfil público" do profissional recomendado quebrou o caminho.

Contexto:
A navegação contextual usa query params:
from=partner
returnTo=/partner/recommendations ou /partner/notifications

Suspeita:
Helper buildDiscoverUrl / resolvePublicPageBackLink / montagem de href está gerando URL inválida, duplicada ou mal encodada.

Não alterar schema.
Não alterar engines.
Não criar feature nova.
Corrigir apenas links/hrefs.

Auditar:
1. modules/partner-portal/domain/navigation.ts
2. partner-recommendations-list.tsx
3. notification queries/hrefs
4. links para /discover/[professionalId]
5. links para /partners/[slug]
6. uso de encodeURIComponent em returnTo

Regras:
- Link de perfil público do profissional em /partner/recommendations:
  /discover/[professionalId]?from=partner&returnTo=/partner/recommendations

- Link vindo de notificações do parceiro:
  /discover/[professionalId]?from=partner&returnTo=/partner/notifications

- Link de perfil público do parceiro:
  /partners/[slug]?from=partner&returnTo=/partner

- Tutor normal:
  /discover/[professionalId] sem query extra, salvo quando houver returnTo seguro

- Nunca gerar URL relativa quebrada.

Retestar:
1. /partner/recommendations → Perfil público → abre /discover/[id] corretamente.
2. No perfil público, botão "Voltar ao portal parceiro" → volta para /partner/recommendations.
3. /partner/notifications → clique em profissional indicado → abre /discover/[id] corretamente.
4. Voltar → /partner/notifications.
5. Notificações tutor/profissional/admin levam para rotas corretas.

Retornar:
- causa exata
- arquivos corrigidos
- exemplos de href antes/depois
- typecheck/lint/build
```

---

## 20. Mensagem final para novo agente

Você está assumindo um produto já avançado.  
Não trate como scaffold.  
Não reescreva arquitetura.  
Não invente novas engines.  
Não duplique módulos.

A prioridade agora é:

1. corrigir links da etapa 7.5
2. validar notificações
3. fechar commit/tag v0.7.5
4. avançar para agenda/disponibilidade com cuidado

O valor da Peteen está em:

- confiança contextual
- recorrência
- histórico real
- validação social
- parceiros
- segurança emocional

Toda decisão deve proteger essa tese.

