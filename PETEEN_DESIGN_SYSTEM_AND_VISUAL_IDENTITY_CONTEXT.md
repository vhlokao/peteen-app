# PETEEN — DESIGN SYSTEM E IDENTIDADE VISUAL CONTEXT

**Versão:** v1  
**Data:** 2026-06-27  
**Projeto:** Peteen  
**Função deste documento:** consolidar a identidade visual, direção de UX, design system e regras de interface da Peteen para que outro agente consiga continuar telas, componentes e refinamentos visuais sem descaracterizar o produto.

> Este documento complementa:
>
> 1. `PETEEN_MASTER_CONTEXT_v2.md`
> 2. `PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md`
> 3. `PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md`
> 4. `PETEEN_HANDOFF_INDEX.md`
> 5. `PETEEN_MONETIZATION_AND_PRICING_CONTEXT.md`

---

## 1. Ideia central da identidade

A Peteen não deve parecer um marketplace comum de serviços pet.

A identidade visual deve comunicar:

```text
confiança
cuidado
proximidade
segurança emocional
rede local
profissionalismo
tecnologia leve
reputação real
```

A interface deve parecer uma rede confiável de pessoas para cuidar de pets, não um catálogo barato de prestadores.

### Frase-guia visual

> Uma experiência premium, humana e acolhedora para escolher com segurança quem cuida do seu pet.

---

## 2. Personalidade visual da marca

A Peteen deve ter uma personalidade visual:

- premium, mas acessível
- humana, mas não infantil
- acolhedora, mas não amadora
- tecnológica, mas não fria
- local, mas escalável
- confiável, mas não burocrática
- emocional, mas não exagerada

### O que a marca deve transmitir

```text
“Eu posso confiar nessa rede.”
“Esse profissional tem histórico real.”
“Esse cuidado parece seguro.”
“Tem gente e contexto por trás da recomendação.”
“Não estou escolhendo só por preço.”
```

### O que a marca não deve transmitir

```text
“Catálogo de anúncio.”
“OLX de cuidador.”
“App barato de contratação rápida.”
“Ranking comprado.”
“Pet shop genérico.”
“Interface infantilizada com patinhas demais.”
```

---

## 3. Referências visuais decididas

Referências macro:

- Airbnb — confiança, cards humanos, experiência de descoberta
- Stripe — clareza, tecnologia premium, uso refinado de layout
- Linear — precisão, dark mode forte, organização visual
- Notion — simplicidade, blocos claros, hierarquia limpa
- Headspace — acolhimento, leveza, emoção sem agressividade
- Rover — contexto pet, serviços e cuidado

Essas referências não devem ser copiadas literalmente.

Devem orientar a sensação:

```text
Airbnb + Linear + Headspace aplicado ao universo pet local brasileiro.
```

---

## 4. Direção visual consolidada

A direção visual já definida no projeto é:

- premium
- humana
- acolhedora
- baseada em confiança
- dark mode forte
- cards limpos
- badges pequenos
- linguagem simples
- menos termos técnicos
- paleta com azul confiança, verde confiança, cinzas neutros e off-white

O dark mode pode ser usado como experiência premium, principalmente nos portais e dashboards. O light mode pode ser usado com força em discovery, landing, onboarding e áreas de leitura mais leve.

---

## 5. Paleta conceitual

### 5.1 Cores base — light mode

```css
--background: #FAFAF8;
--surface: #FFFFFF;
--surface-soft: #F4F1EC;
--foreground: #1A1A1A;
--muted-foreground: #6B6B63;
--border: #E8E3DA;
```

Uso:

- `background`: fundo geral claro, mais quente que branco puro.
- `surface`: cards principais, modais e containers.
- `surface-soft`: blocos secundários, highlights suaves e áreas de apoio.
- `foreground`: textos principais.
- `muted-foreground`: textos auxiliares, descrições, metadados.
- `border`: divisórias e contornos suaves.

### 5.2 Cores de confiança

```css
--primary: #2D6A4F;
--primary-soft: #D8F3DC;
--trust: #1D3557;
--trust-soft: #E8EEF6;
```

Uso:

- `primary`: CTAs principais positivos, ações de confiança e botões confirmativos.
- `primary-soft`: fundos de selo, alertas positivos e estados suaves.
- `trust`: elementos de autoridade, Índice de Confiança, headers institucionais.
- `trust-soft`: fundos informativos relacionados a confiança.

### 5.3 Cor emocional/acento

```css
--accent: #E07A5F;
--accent-soft: #FCE8E1;
```

Uso:

- Destaques emocionais.
- Microinterações.
- Callouts humanos.
- Pequenos detalhes que evitam a interface ficar fria.

Não usar coral como cor principal de ação crítica.

### 5.4 Estados semânticos

```css
--success: #40916C;
--warning: #F4A261;
--danger: #C1121F;
--info: #457B9D;
```

Uso:

- `success`: aprovado, concluído, ativo, verificado.
- `warning`: pendente, em análise, atenção.
- `danger`: cancelado, disputa crítica, bloqueio, erro.
- `info`: informativo, neutro operacional, status administrativo.

### 5.5 Dark mode

```css
--background-dark: #0B1014;
--surface-dark: #111820;
--surface-elevated-dark: #17212B;
--foreground-dark: #F6F7F4;
--muted-foreground-dark: #A8B0AA;
--border-dark: #25313A;
--primary-dark: #74C69D;
--trust-dark: #A8DADC;
--accent-dark: #F2A38B;
```

Uso:

- Dashboards.
- Áreas administrativas.
- Métricas.
- CRM profissional.
- Experiência premium.

Regra:

> Dark mode Peteen não deve parecer hacker/cyberpunk. Deve parecer premium, sereno, limpo e confiável.

---

## 6. Tipografia

### 6.1 Direção tipográfica

A tipografia deve ser:

- limpa
- moderna
- legível
- com leve personalidade
- sem aparência infantil
- sem parecer app financeiro frio demais

Sugestão consolidada:

```text
Display / títulos: Plus Jakarta Sans
Texto / UI: Geist Sans ou Inter
Código / debug/admin técnico: Geist Mono
```

Se o projeto já estiver usando Geist Sans + Plus Jakarta, manter essa combinação.

### 6.2 Hierarquia sugerida

```css
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
--text-4xl: 2.25rem;
```

### 6.3 Pesos

```text
400 — texto normal
500 — labels, navegação, microcopy importante
600 — títulos de cards, botões, subtítulos
700 — hero, headlines e números fortes
```

Evitar excesso de bold.

---

## 7. Espaçamento, raio e grid

### 7.1 Grid

Usar lógica de 4/8px:

```text
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px
```

### 7.2 Radius

Direção geral:

```css
--radius-sm: 0.5rem;
--radius-md: 0.75rem;
--radius-lg: 1rem;
--radius-xl: 1.25rem;
--radius-2xl: 1.5rem;
```

Uso:

- botões pequenos: `0.75rem`
- inputs: `0.75rem`
- cards: `1rem` a `1.25rem`
- cards premium/hero: `1.5rem`

Evitar cards totalmente quadrados.

### 7.3 Sombra

Sombra deve ser suave.

Light mode:

```css
--shadow-card: 0 8px 30px rgba(20, 20, 20, 0.06);
--shadow-soft: 0 4px 16px rgba(20, 20, 20, 0.04);
```

Dark mode:

```css
--shadow-card-dark: 0 14px 40px rgba(0, 0, 0, 0.28);
```

Não usar sombras fortes demais.

---

## 8. Componentes centrais

### 8.1 Cards

Cards são a base da interface.

Tipos:

- card de profissional
- card de pet
- card de solicitação
- card de histórico
- card de atividade
- card de notificação
- card de disputa
- card de métrica
- card de plano pago
- card de parceiro

Regra:

> Card Peteen deve sempre ajudar o usuário a entender confiança, contexto e próxima ação.

Um card bom deve ter:

```text
título claro
contexto curto
status visível
sinal de confiança quando aplicável
ação principal clara
respiro visual
```

### 8.2 ProfessionalCard / card público do profissional

Deve priorizar:

1. nome/foto
2. localização
3. tipo de serviço
4. Índice de Confiança ou estado público de confiança
5. badges reais
6. avaliações reais
7. recorrência/experiência quando existir
8. preço como informação, nunca como centro do card

Nunca transformar o card em leilão de preço.

### 8.3 Badges

Badges são sinais de reputação, não decoração.

Badges públicos permitidos:

- Verificado
- Recomendado
- Cliente Recorrente
- Experiente
- Bem Avaliado

Badge que não deve aparecer publicamente ainda:

- Documento Verificado

Regra:

> Não mostrar badge público se não existe fluxo real por trás.

### 8.4 Trust / Índice de Confiança

A apresentação pública da confiança precisa ser cuidadosa.

Para profissionais com pouca evidência, usar linguagem humana:

```text
Confiança em construção
Confiança inicial
Boa reputação
Muito confiável
Referência local
```

Não mostrar score numérico de forma agressiva se o contexto ainda é fraco.

A UI deve evitar prometer certeza absoluta.

### 8.5 RequestTimeline

Solicitações devem ter linha do tempo clara.

Estados visuais:

```text
Pendente
Aceita
Em andamento
Concluída
Cancelada
Em disputa
Expirada
```

Cada estado deve ter:

- cor semântica
- descrição humana
- próxima ação possível

### 8.6 DisputeBanner / DisputeStatusCard

Disputa deve parecer séria, mas não assustadora.

Tom:

```text
Estamos analisando este caso.
Acompanhe o andamento por aqui.
```

Evitar:

```text
Problema grave
Conta em risco
Profissional denunciado
```

Até a disputa ser resolvida, a linguagem deve ser neutra e justa.

### 8.7 NotificationCard

Notificações são itens de atenção, não histórico completo.

Deve ter:

- ícone
- título curto
- descrição
- data
- CTA/link seguro

Não gerar audit ao visualizar.

### 8.8 ActivityCard

Activity é histórico.

A diferença precisa permanecer clara:

```text
Atividades = o que aconteceu.
Notificações = o que pede atenção.
```

### 8.9 PricingCard / planos pagos

O card de plano pago precisa comunicar ferramentas, não compra de reputação.

Profissional Pro pode destacar:

- agenda
- CRM pet
- analytics
- métricas de recorrência
- selo verificado quando elegível e aprovado
- recursos de gestão

Não escrever:

```text
Ganhe mais confiança pagando
Suba no ranking pagando
Compre destaque garantido
```

Escrever:

```text
Ferramentas para organizar seus atendimentos e acompanhar sua reputação.
```

---

## 9. Layout por área do produto

### 9.1 Marketing / Landing

Sensação:

- clara
- emocional
- premium
- confiável
- com narrativa forte

Priorizar:

```text
hero humano
prova de confiança
como funciona
para tutores
para profissionais
para parceiros
segurança e reputação
CTA simples
```

Evitar:

- excesso de features técnicas
- layout de marketplace genérico
- foco em “menor preço”

### 9.2 Discovery

Discovery deve parecer escolha segura.

Priorizar:

- filtros simples
- cards confiáveis
- contexto local
- badges reais
- avaliações reais
- confiança contextual

Preço não deve dominar.

### 9.3 Perfil público do profissional

Deve responder:

```text
Quem é essa pessoa?
Onde atende?
Que serviços oferece?
Que evidências de confiança existem?
Quem recomenda?
Já teve recorrência?
Como solicitar?
```

Hierarquia recomendada:

1. Header com nome, foto, local e CTA
2. Resumo de confiança
3. Serviços ativos
4. Avaliações
5. Recomendações/parceiros
6. Histórico/reputação quando aplicável
7. Solicitar serviço

### 9.4 Portal do tutor

Sensação:

- simples
- acolhedora
- orientada a acompanhamento

Priorizar:

- pets
- solicitações em andamento
- notificações
- profissionais recentes
- histórico

### 9.5 Portal do profissional

Sensação:

- painel de operação simples
- profissionalização
- controle de agenda/clientes/reputação

Priorizar:

- solicitações recebidas
- próximos atendimentos
- clientes
- serviços
- avaliações
- métricas
- confiança
- notificações

### 9.6 Portal do parceiro

Sensação:

- institucional
- curadoria
- rede local de confiança

Priorizar:

- profissionais recomendados
- impacto da organização
- métricas
- perfil público
- status de verificação

### 9.7 Admin

Sensação:

- operacional
- denso, mas limpo
- confiável
- sem firula visual excessiva

Priorizar:

- tabelas claras
- filtros
- status
- audit trail
- ações seguras
- separação entre dado público e interno

---

## 10. Linguagem e microcopy

### 10.1 Tom de voz

Peteen deve falar como:

```text
uma marca confiável, humana e calma
```

Não deve falar como:

```text
marketplace agressivo
app de delivery
SaaS corporativo frio
pet shop infantilizado
```

### 10.2 Substituições importantes

| Evitar | Usar |
|---|---|
| Trust Score | Índice de Confiança / Confiança |
| Trust Graph | Rede de Confiança |
| Reviews | Avaliações |
| Risk Score | Índice de Risco |
| Activity Center | Atividades |
| Recommendation | Recomendação |
| Partner | Parceiro |
| Professional | Profissional |
| Request | Solicitação |

### 10.3 Exemplos de texto bom

```text
Profissional recomendado por parceiros da rede.
Atendimento concluído com avaliação positiva.
Este perfil ainda está construindo histórico na Peteen.
Você já contratou este profissional antes.
Essa recomendação faz parte da rede de confiança local.
```

### 10.4 Exemplos de texto ruim

```text
Top 1 da plataforma.
Mais barato da sua região.
Contrate agora antes que acabe.
Compre destaque para parecer mais confiável.
Score máximo garantido.
```

---

## 11. Iconografia

Ícones devem ser:

- lineares
- simples
- consistentes
- pouco decorativos
- com peso visual parecido

Biblioteca provável:

```text
lucide-react
```

Direção:

- sino para notificações
- escudo para confiança/verificação
- estrela para avaliação
- coração/pet para cuidado
- mapa/pin para localização
- relógio para agenda
- usuários/rede para relacionamento
- alerta para disputa/risco
- check para concluído/aprovado

Não exagerar em ícones de pata.

---

## 12. Ilustração e fotografia

### 12.1 Fotografia

Se usar imagens:

- pessoas reais ou realistas
- pets em contexto de cuidado
- ambientes domésticos/locais reais
- luz natural
- emoção sutil

Evitar:

- banco de imagem muito artificial
- pets recortados sem contexto
- imagens infantis demais
- estética veterinária hospitalar fria

### 12.2 Ilustração

Pode usar ilustrações leves, mas com cuidado.

Estilo:

- minimalista
- orgânico
- amigável
- sem excesso de cartoon

Não transformar a Peteen em marca infantil.

---

## 13. Motion e microinterações

Motion deve ser leve.

Usar para:

- transição de cards
- feedback de botão
- abertura de dropdown
- atualização de status
- estados de carregamento

Evitar:

- animações longas
- bounce exagerado
- confete para confiança
- gamificação agressiva

Princípio:

> Movimento deve aumentar clareza, não chamar atenção para si mesmo.

---

## 14. Acessibilidade

Obrigatório manter:

- contraste adequado no light e dark mode
- foco visível em botões/links/inputs
- área clicável confortável no mobile
- labels em inputs
- textos de erro claros
- não depender só de cor para status
- ícones com texto quando a ação for importante

Tamanho mínimo de toque recomendado:

```text
44px
```

---

## 15. Responsividade

A Peteen deve ser mobile-first, mas com desktop forte.

### Mobile

Priorizar:

- cards empilhados
- bottom nav quando já existir
- CTAs claros
- pouco texto por tela
- formulários curtos

### Desktop

Priorizar:

- dashboards com grid
- sidebar
- tabelas admin
- comparações
- métricas
- detalhes em duas colunas

---

## 16. Design system técnico

### 16.1 Stack visual

O projeto usa:

- Tailwind CSS
- shadcn/ui
- componentes modulares
- Next.js App Router
- dark mode

Regras:

- reutilizar componentes existentes
- não criar biblioteca paralela
- não duplicar Button/Card/Input/Badge se já existir
- respeitar `components/ui`
- componentes de domínio ficam em `modules/<domain>/components`

### 16.2 Tokens antes de componentes

Antes de redesenhar tela grande, revisar:

```text
globals.css
tailwind config se existir
components/ui
layout/app-shell
top-bar
nav-config
```

### 16.3 Não fazer redesign global no escuro

Não alterar tudo de uma vez.

Para evoluir o design system:

```text
1. Auditar tokens atuais
2. Mapear componentes existentes
3. Ajustar uma tela piloto
4. Validar visual
5. Aplicar incrementalmente
```

---

## 17. Regras para agentes ao mexer em UI

### Pode usar Composer Fast para

- ajustes visuais pequenos
- cards
- badges
- empty states
- links
- responsividade
- copy
- labels
- formulários simples
- página de pricing visual
- landing visual sem regra crítica

### Usar Sonnet antes para

- redesign global
- nova arquitetura de design tokens
- refatoração de AppShell
- mudança de tema/dark mode global
- design system cross-module
- telas que misturam monetização + ranking + confiança
- mudança de UX em Trust Score
- mudança visual que impacta percepção de reputação

Regra:

```text
Se for componente isolado, Composer Fast.
Se mudar a linguagem visual global, Sonnet primeiro.
```

---

## 18. Design aplicado à monetização

A monetização deve parecer extensão natural da operação profissional.

### Profissional Pro

Visual:

- card premium
- benefícios claros
- sem pressão agressiva
- sem promessa de ranking
- sem promessa de confiança comprada

Copy recomendada:

```text
Organize sua rotina, acompanhe seus clientes e entenda sua reputação na Peteen.
```

### Destaque Local

Visual:

- deve parecer elegível/criterioso
- não deve parecer anúncio comprado livremente

Copy recomendada:

```text
Disponível para profissionais com sinais mínimos de confiança e atuação local.
```

### Parceiros

Visual:

- mais institucional
- foco em rede, impacto e credibilidade

Copy recomendada:

```text
Fortaleça a rede local de cuidado pet recomendando profissionais confiáveis.
```

---

## 19. Design aplicado à confiança

A confiança deve ser mostrada como evidência, não como enfeite.

### Bons sinais visuais

- resumo de confiança
- badges com tooltip/descrição
- histórico de recorrência
- parceiro recomendador
- número de avaliações
- serviços concluídos
- verificação ativa

### Evitar

- score gigante sem contexto
- ranking agressivo
- medalhas exageradas
- gamificação de confiança
- selo pago parecendo selo reputacional

---

## 20. Do / Don't visual

### Fazer

```text
Usar cards limpos.
Dar respiro.
Mostrar contexto antes de preço.
Usar badges pequenos.
Usar linguagem humana.
Mostrar sinais reais de confiança.
Usar dark mode premium com sobriedade.
Usar off-white no light mode.
Usar verdes e azuis para confiança.
```

### Não fazer

```text
Não virar marketplace de preço.
Não encher de patinhas e ilustração infantil.
Não usar neon exagerado.
Não colocar preço como elemento dominante.
Não usar badges falsos.
Não esconder contexto de confiança.
Não criar tela corporativa fria demais.
Não criar redesign global sem auditoria.
```

---

## 21. Roadmap de design system

### Fase 1 — Auditoria visual atual

Objetivo:

- mapear tokens existentes
- mapear componentes UI
- mapear inconsistências
- identificar telas mais importantes

Sem alterar código.

### Fase 2 — Tokens oficiais

Criar/ajustar:

- cores
- radius
- sombras
- typography
- spacing
- semantic colors
- dark mode

### Fase 3 — Componentes base

Revisar:

- Button
- Card
- Badge
- Input
- Textarea
- Select
- Tabs
- Table
- Dialog
- EmptyState
- StatusPill

### Fase 4 — Componentes de domínio

Revisar:

- ProfessionalCard
- TrustSummaryCard
- RequestStatusCard
- RequestTimeline
- DisputeBanner
- NotificationCard
- ActivityCard
- PartnerRecommendationCard
- PricingCard

### Fase 5 — Telas piloto

Aplicar primeiro em:

1. `/discover`
2. `/discover/[professionalId]`
3. `/professional`
4. `/partner/recommendations`
5. `/admin/disputes`

### Fase 6 — Padronização geral

Só depois aplicar em todos os portais.

---

## 22. Prompt para agente — Auditoria de Design System

```text
Você está assumindo a auditoria visual e de design system da Peteen.

Leia antes:
- PETEEN_MASTER_CONTEXT_v2.md
- PETEEN_DESIGN_SYSTEM_AND_VISUAL_IDENTITY_CONTEXT.md
- PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md

Contexto:
Peteen não é marketplace genérico. É uma rede premium de confiança para cuidados pet, baseada em reputação contextual, recorrência, parceiros e segurança emocional.

Objetivo:
Auditar o design system atual SEM alterar código.

Investigue:
1. tokens atuais de cor, radius, sombras e tipografia
2. componentes em components/ui
3. AppShell, TopBar, nav e layouts
4. cards principais
5. badges de reputação
6. telas de discovery
7. perfil público do profissional
8. portais tutor/profissional/parceiro/admin
9. inconsistências de dark/light mode
10. pontos onde a UI parece marketplace genérico
11. pontos onde preço aparece com peso visual indevido
12. pontos onde confiança não está clara
13. pontos onde há linguagem técnica demais

Não alterar:
- schema
- engines
- regras de negócio
- navegação funcional
- Trust Score
- Ranking
- Recommendation

Retorne:
- mapa de componentes lidos
- inconsistências visuais
- riscos de UX
- recomendações por prioridade
- proposta de tokens oficiais
- telas piloto sugeridas
- plano incremental de implementação
```

---

## 23. Prompt para Composer Fast — Aplicar etapa pequena de UI

```text
Vamos aplicar uma etapa pequena e isolada do Design System da Peteen.

Leia:
- PETEEN_DESIGN_SYSTEM_AND_VISUAL_IDENTITY_CONTEXT.md
- PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md

Escopo fechado:
[descrever componente ou tela]

Objetivo visual:
- premium
- humano
- acolhedor
- confiança
- cards limpos
- linguagem simples

Não alterar:
- schema
- engines
- regras de negócio
- rotas fora do escopo
- guards
- queries

Regras:
- reutilizar componentes existentes
- não duplicar Button/Card/Badge/Input
- manter responsivo
- manter dark mode
- não priorizar preço visualmente
- não criar badge falso
- rodar typecheck/lint/build

Retornar:
- arquivos alterados
- antes/depois visual descrito
- riscos
- testes manuais
```

---

## 24. Checklist final para qualquer ajuste visual

Antes de considerar pronto:

```text
[ ] A tela continua parecendo Peteen, não marketplace.
[ ] Confiança aparece antes de preço quando relevante.
[ ] Badges são reais e não exagerados.
[ ] Light/dark mode continuam legíveis.
[ ] Mobile continua bom.
[ ] Não quebrei rota/link.
[ ] Não alterei regra de negócio.
[ ] Não alterei engine.
[ ] Não criei componente duplicado desnecessário.
[ ] Rodei typecheck.
[ ] Rodei lint.
[ ] Rodei build.
```

---

## 25. Mensagem final para o próximo agente

A identidade visual da Peteen precisa proteger a tese do produto.

O design não é só estética. Ele precisa fazer o tutor sentir que está escolhendo alguém confiável, fazer o profissional perceber valor em construir reputação real e fazer o parceiro parecer parte de uma rede de credibilidade.

Toda decisão visual deve reforçar:

```text
confiança contextual
recorrência
segurança emocional
histórico real
rede local
profissionalismo humano
```

Se uma tela começar a parecer catálogo de preço, marketplace genérico ou painel frio demais, ela está indo na direção errada.
