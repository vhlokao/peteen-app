# PETEEN — MONETIZAÇÃO, PLANOS, PRICE TABLE E BILLING CONTEXT

**Versão:** v1  
**Data:** 2026-06-27  
**Projeto:** Peteen  
**Função deste arquivo:** complementar o pacote de handoff com a visão de monetização, planos pagos do profissional, regras de preço, price table, limites éticos de monetização e futuras etapas técnicas de billing.

> Este documento deve ser lido junto com:
>
> 1. `PETEEN_HANDOFF_INDEX.md`
> 2. `PETEEN_MASTER_CONTEXT_v2.md`
> 3. `PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md`
> 4. `PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md`

---

## 1. Por que este documento existe

O Peteen já possui uma tese de produto muito clara: não é marketplace genérico, é uma rede de confiança para cuidados pet.

Mas ainda faltava deixar explícito para o próximo agente como deve funcionar a camada paga do produto, principalmente:

- planos do profissional
- price table / tabela de preços da landing
- Destaque Local
- planos para parceiros
- limites do que pode ou não ser vendido
- diferença entre preço do serviço e preço da plataforma
- futura arquitetura de billing/subscription
- quando usar Composer Fast e quando usar Sonnet nessa frente

Este documento protege uma regra central:

> Peteen pode monetizar ferramentas, visibilidade elegível e operação, mas não pode vender confiança falsa.

---

## 2. Decisões de monetização já tomadas

### 2.1 Tutor grátis

Tutor não paga para usar o Peteen no MVP.

O tutor deve conseguir:

- criar conta
- cadastrar pets
- buscar profissionais
- solicitar serviço
- acompanhar solicitações
- avaliar
- abrir disputa
- ver histórico

Sem cobrança.

**Motivo:** o tutor é o lado de demanda e alimenta a rede com solicitações, avaliações, recorrência e confiança.

---

### 2.2 Profissional Free

O profissional pode usar a plataforma gratuitamente no plano inicial.

O plano Free deve permitir:

- criar perfil profissional
- aparecer no discovery, respeitando regras de qualidade/ranking
- cadastrar serviços básicos
- receber solicitações
- aceitar/rejeitar solicitações
- concluir atendimentos
- receber avaliações
- construir histórico e reputação
- acessar notificações e atividades básicas

**Regra importante:** o Free não pode ser inútil. Se o plano gratuito não permitir construir reputação real, a rede não nasce.

---

### 2.3 Profissional Pro

Modelo planejado:

```text
Profissional Pro: R$29,90/mês
```

Benefícios planejados:

- agenda
- analytics
- CRM pet
- métricas de recorrência
- ferramentas avançadas de relacionamento
- perfil mais completo
- recursos operacionais para profissional sério
- solicitação/gestão de verificação, quando o fluxo existir

**Ponto sensível:** o plano Pro não deve comprar confiança.

Se houver benefício relacionado a selo/verificação, a regra correta é:

```text
O Pro pode desbloquear ou facilitar o processo de verificação, mas o selo só aparece após validação real.
```

Nunca implementar:

```text
Pagou Pro → ganhou selo automaticamente.
```

---

### 2.4 Destaque Local

Modelo planejado:

```text
Destaque Local: R$19,90/mês
```

Mas somente para profissionais elegíveis.

Destaque Local é um add-on de visibilidade, não uma compra de reputação.

Pode dar:

- card destacado em região/bairro
- presença em seção patrocinada
- prioridade em vitrine local separada
- tag clara tipo `Destaque local`

Não pode:

- sobrescrever ranking orgânico de confiança
- esconder profissionais mais confiáveis
- parecer recomendação editorial se for pago
- ser vendido para perfil suspeito
- ser permitido sem critérios mínimos

Critérios futuros de elegibilidade possíveis:

- perfil completo
- serviço ativo
- sem flags graves abertas
- sem disputa crítica recente
- verificação aprovada ou ao menos em bom estado operacional
- mínimo de reputação ou confiança inicial
- bairro/cidade configurados

Regra:

> Destaque compra exposição controlada, não compra confiança.

---

### 2.5 Parceiros pagos

Modelo planejado:

```text
Parceiros: R$99 a R$299/mês
```

Possíveis benefícios:

- página pública da organização
- selo de parceiro verificado após validação real
- portal parceiro
- recomendações de profissionais
- métricas da rede local
- analytics de recomendações
- destaque institucional em região
- campanhas locais com Peteen

Ponto sensível:

```text
Parceiro ajuda a validar a rede, mas não compra reputação para profissional.
```

A recomendação do parceiro precisa continuar sujeita a regras de confiança, antifraude e verificação.

---

### 2.6 Take rate

Modelo decidido para MVP:

```text
Take rate: zero no MVP.
```

Ou seja:

- Peteen não cobra percentual sobre o serviço no MVP
- o profissional define o preço dele
- pagamento do serviço pode acontecer fora da plataforma inicialmente
- WhatsApp continua como camada de comunicação, não núcleo financeiro

Isso evita:

- guerra de preço
- fricção inicial
- complexidade financeira prematura
- dependência de transação para validar confiança

---

## 3. Diferença crítica: preço do serviço vs preço da plataforma

O próximo agente não pode confundir estas duas coisas.

### 3.1 Preço do serviço

É o preço que o profissional cobra do tutor.

Exemplos:

```text
Passeio: R$40
Pet sitting: R$90
Hospedagem: R$120
Adestramento: R$180
```

Esse preço pertence ao profissional.

Regras:

- profissional define seus próprios preços
- Peteen não deve ranquear por menor preço
- preço não deve ser o coração da experiência
- o card pode mostrar faixa/preço, mas a decisão deve ser baseada em confiança

No sistema atual, já existe catálogo de serviços do profissional e foi validado que serviços podem ser criados, editados, ativados/desativados e aparecer/sumir do perfil público.

### 3.2 Preço da plataforma

É o que Peteen cobra de profissionais ou parceiros.

Exemplos:

```text
Profissional Pro: R$29,90/mês
Destaque Local: R$19,90/mês
Parceiro: R$99 a R$299/mês
```

Esse preço pertence ao modelo de negócio da Peteen.

Regras:

- tutor grátis
- profissional free existe
- Pro vende ferramentas
- Destaque vende exposição elegível
- parceiro paga por operação/rede/métricas, não por reputação falsa

---

## 4. Price Table / tabela de preços

### 4.1 O que é a Price Table

A Price Table é uma seção de UI/landing para explicar os planos.

Ela pode aparecer em:

```text
/pricing
/(marketing)/pricing
landing page
página inicial
seção de planos para profissionais
seção de planos para parceiros
```

**Estado atual:** não assumir que já existe implementada. O próximo agente deve auditar o código antes.

Buscar por termos como:

```text
pricing
price-table
PriceTable
plans
subscription
billing
checkout
stripe
mercadopago
plan
professional pro
```

### 4.2 Price Table inicial sugerida

#### Plano Tutor

```text
Tutor
Grátis
Para encontrar pessoas confiáveis para cuidar do seu pet.

Inclui:
- cadastro de pets
- busca de profissionais
- solicitações
- avaliações
- histórico
- notificações
```

CTA:

```text
Encontrar cuidador
```

#### Profissional Free

```text
Profissional Free
Grátis
Para começar a construir reputação na rede.

Inclui:
- perfil profissional
- serviços básicos
- recebimento de solicitações
- avaliações
- histórico com tutores
- índice de confiança básico
```

CTA:

```text
Começar grátis
```

#### Profissional Pro

```text
Profissional Pro
R$29,90/mês
Para profissionais que querem organizar agenda, clientes e recorrência.

Inclui:
- agenda
- CRM pet
- analytics
- métricas de recorrência
- perfil profissional avançado
- ferramentas para relacionamento com clientes
- recursos de verificação quando disponíveis
```

CTA:

```text
Ativar Pro
```

Observação obrigatória:

```text
Recursos de verificação não garantem selo automático. A validação depende de aprovação.
```

#### Destaque Local

```text
Destaque Local
R$19,90/mês
Add-on para profissionais elegíveis ganharem mais visibilidade na região.

Inclui:
- destaque em área local
- exposição controlada
- tag de destaque
- métricas básicas de visibilidade
```

CTA:

```text
Ver elegibilidade
```

Observação obrigatória:

```text
Disponível somente para perfis elegíveis. Não altera o Índice de Confiança.
```

#### Parceiros

```text
Parceiros
R$99 a R$299/mês
Para empresas pet que querem participar da rede de confiança local.

Inclui:
- página pública
- portal parceiro
- recomendações de profissionais
- métricas da rede
- verificação institucional
```

CTA:

```text
Falar com a Peteen
```

---

## 5. Regras éticas e de produto para monetização

### 5.1 O que pode ser vendido

Pode vender:

- ferramentas de gestão
- CRM
- agenda
- analytics
- métricas
- personalização de perfil
- recursos avançados
- exposição patrocinada clara
- página de parceiro
- relatórios
- automações futuras

### 5.2 O que não pode ser vendido

Não vender diretamente:

- Índice de Confiança
- badge de confiança sem lastro
- recomendação falsa
- avaliação
- recorrência
- posição orgânica no ranking
- selo verificado automático
- remoção de disputa/flag
- ocultação de avaliação negativa
- privilégio invisível contra profissionais Free

### 5.3 Regra central

```text
Pagamento pode melhorar operação e exposição.
Pagamento não pode falsificar reputação.
```

---

## 6. Como planos pagos podem afetar Ranking e Discovery

### 6.1 Ranking orgânico

Ranking orgânico deve continuar baseado em:

- confiança
- recorrência
- qualidade do histórico
- avaliações
- verificação real
- localização/contexto
- disponibilidade futura
- sinais antifraude

Não deve priorizar menor preço.

Não deve priorizar automaticamente quem paga.

### 6.2 Destaque pago

Destaque pago deve aparecer separado ou marcado.

Exemplo seguro:

```text
Destaques locais
Profissionais elegíveis com maior visibilidade na sua região.
```

Ou:

```text
Patrocinado / Destaque local
```

Não misturar invisivelmente com ranking orgânico.

### 6.3 Elegibilidade

Antes de ativar destaque, checar no futuro:

- perfil completo
- serviço ativo
- sem bloqueio operacional
- sem risco alto
- sem verificação suspensa
- sem disputa grave recente

---

## 7. Arquitetura futura de planos e billing

### 7.1 Estado atual

Não confirmar que já existe billing implementado.

O próximo agente deve auditar o schema e o código antes de qualquer implementação.

Buscar por:

```text
Subscription
Plan
Billing
Invoice
Payment
Checkout
PriceTable
FeatureFlag
Entitlement
Stripe
MercadoPago
```

### 7.2 Não criar migration sem autorização

Billing é área sensível.

Não criar tabela nova sem confirmação explícita do Vitor.

Antes de migration, fazer plano Sonnet.

### 7.3 Entidades futuras possíveis

Somente sugestão futura, não implementar sem aprovação:

```text
SubscriptionPlan
ProfessionalSubscription
PartnerSubscription
BillingEvent
PaymentProviderCustomer
FeatureEntitlement
LocalHighlightPlacement
PlanChangeAudit
```

Possíveis campos:

```text
planId
ownerType
ownerId
status
currentPeriodStart
currentPeriodEnd
cancelAtPeriodEnd
provider
providerCustomerId
providerSubscriptionId
createdAt
updatedAt
```

Status possíveis:

```text
FREE
TRIALING
ACTIVE
PAST_DUE
CANCELED
SUSPENDED
EXPIRED
```

### 7.4 Feature Entitlements

A plataforma deve pensar em permissões por recurso.

Exemplos:

```text
canUseAgenda
canUseAdvancedCrm
canSeeAnalytics
canRequestVerification
canUseLocalHighlight
canExportClients
canCustomizeProfile
```

Regra técnica:

```text
Gating de recurso pago deve ser validado no servidor, não só no front-end.
```

### 7.5 Auditoria obrigatória em billing

Mutations financeiras e de plano devem gerar audit.

Eventos futuros possíveis:

```text
billing.subscription_created
billing.subscription_updated
billing.subscription_canceled
billing.subscription_reactivated
billing.payment_failed
billing.local_highlight_requested
billing.local_highlight_approved
billing.local_highlight_rejected
billing.entitlement_changed
```

---

## 8. Gateway de pagamento futuro

Ainda não decidido neste documento.

Possibilidades:

- Stripe
- Mercado Pago
- Pagar.me
- Asaas
- outro gateway brasileiro

Não implementar gateway sem decisão explícita.

Nunca colocar em documentos:

- chave secreta
- webhook secret
- token de API
- credenciais
- DATABASE_URL
- service role key

### 8.1 Webhooks

Quando houver gateway, tratar webhooks como área crítica.

Regras:

- validar assinatura do webhook
- idempotência obrigatória
- não confiar no front-end para ativar plano
- registrar BillingEvent
- auditar alterações de plano
- não liberar benefício pago antes de confirmação confiável

---

## 9. Fases recomendadas para monetização

### Fase 0 — Documentação e Price Table estática

Pode ser Composer Fast.

Escopo:

- criar `/pricing` ou seção na landing
- cards de planos
- copy segura
- sem checkout
- sem schema
- sem bloqueio de recurso

Validação:

- UI clara
- sem prometer selo automático
- sem prometer ranking pago
- sem confundir preço do serviço com preço da plataforma

### Fase 1 — Auditoria de código e schema

Preferencialmente Sonnet se for virar implementação.

Escopo:

- verificar se já existe `Subscription`, `Plan`, `Billing`, `PriceTable`, `FeatureFlag`
- mapear rotas de marketing
- mapear onde planos aparecem
- mapear recursos que seriam Pro
- propor arquitetura de entitlements

Sem alterar código.

### Fase 2 — Plano de Entitlements

Sonnet primeiro.

Objetivo:

- definir recursos Free vs Pro
- definir se haverá trial
- definir como bloquear recurso no servidor
- definir mensagens de upgrade
- definir fallback para usuários atuais

### Fase 3 — Implementação sem gateway real

Pode ser Sonnet + Composer Fast em subetapas.

Exemplo:

- plano manual via admin
- feature flags internas
- tela de upgrade mockada
- sem cobrança real

Útil para validar UX antes de pagamento.

### Fase 4 — Gateway real

Somente com plano aprovado.

Envolve:

- checkout
- customer
- subscription
- webhooks
- idempotência
- secrets
- logs
- status de pagamento
- cancelamento
- falha de pagamento
- retry

### Fase 5 — Destaque Local pago

Somente depois de:

- ranking orgânico protegido
- critérios de elegibilidade
- admin review ou regra automática confiável
- marcação visual clara

---

## 10. Recursos Free vs Pro sugeridos

### Profissional Free

- perfil profissional básico
- serviços básicos
- receber solicitações
- responder solicitações
- avaliações
- índice de confiança básico
- notificações básicas
- activity básico
- histórico básico

### Profissional Pro

- agenda
- disponibilidade avançada
- CRM pet avançado
- tags/anotações de clientes
- analytics
- métricas de recorrência
- insights de perfil
- perfil enriquecido
- lembretes/follow-up futuro
- relatórios simples
- prioridade em suporte, se existir

### Não colocar no Pro automaticamente

- badge `Verificado` sem aprovação
- aumento de Trust Score
- prioridade orgânica no ranking
- exclusão de avaliação negativa
- blindagem contra disputa
- recomendação de parceiro

---

## 11. Copy segura para a Price Table

### Headline

```text
Planos simples para crescer com confiança
```

### Subheadline

```text
Comece grátis, construa reputação real e use ferramentas profissionais quando estiver pronto para organizar sua rotina pet.
```

### Observação geral

```text
A Peteen não vende confiança. Reputação, verificação e recomendações dependem de histórico real, validação e segurança da rede.
```

### Texto para Pro

```text
O Pro ajuda você a organizar agenda, clientes, pets e recorrência. Sua reputação continua sendo construída por atendimentos reais.
```

### Texto para Destaque Local

```text
Destaque Local aumenta sua visibilidade em uma região, mas não altera seu Índice de Confiança nem substitui critérios de segurança.
```

### Texto para Parceiros

```text
Parceiros fortalecem a rede local, recomendando profissionais com responsabilidade e ajudando tutores a encontrar cuidado confiável.
```

---

## 12. Admin futuro para monetização

Possíveis telas futuras:

```text
/admin/billing
/admin/subscriptions
/admin/local-highlights
/admin/partners/billing
/admin/professionals/[id]/subscription
```

Ações futuras:

- ver plano atual
- ativar plano manual para teste
- cancelar plano manualmente
- ver histórico de billing
- aprovar/rejeitar destaque local
- suspender destaque
- ver pagamentos com falha

Regra:

```text
Admin pode operar billing, mas não deve alterar confiança/reputação como atalho comercial.
```

---

## 13. Prompts recomendados

### 13.1 Prompt para Price Table estática — Composer Fast

```text
Criar uma seção/página de Pricing para Peteen, sem checkout e sem billing real.

Contexto:
Peteen é uma rede de confiança para cuidados pet, não marketplace. Tutor usa grátis. Profissional pode usar Free ou Pro. Parceiros têm planos próprios. O objetivo é comunicar planos de forma clara sem vender confiança falsa.

Escopo:
- criar UI de price table em rota ou seção de marketing existente
- planos: Tutor grátis, Profissional Free, Profissional Pro R$29,90/mês, Destaque Local R$19,90/mês, Parceiros R$99–R$299/mês
- CTA sem checkout real
- copy humana
- design premium/limpo

Não fazer:
- não criar schema
- não criar migration
- não integrar gateway
- não criar checkout
- não bloquear recursos
- não alterar Trust/Ranking/Recommendation
- não prometer selo automático
- não prometer ranking pago

Copy obrigatória:
Pagamento pode liberar ferramentas e exposição elegível, mas confiança continua dependendo de histórico real, validação e segurança da rede.

Retornar:
- arquivos criados/alterados
- rota da pricing table
- typecheck/lint/build
```

### 13.2 Prompt para auditoria de monetização — Sonnet

```text
Você está assumindo a auditoria da camada de monetização do Peteen.

Leia:
- PETEEN_MASTER_CONTEXT_v2.md
- PETEEN_AGENT_STRATEGY_AND_TRUST_AUDIT_CONTEXT.md
- PETEEN_AGENT_HANDOFF_PROTOCOL_v1.md
- PETEEN_MONETIZATION_AND_PRICING_CONTEXT.md

Objetivo:
Auditar o código e o schema para entender se já existe alguma estrutura de pricing, billing, subscription, plan, price table, checkout, feature flags ou entitlements.

Não alterar código.
Não criar migration.
Não integrar gateway.
Não criar checkout.
Não alterar Trust/Ranking/Recommendation.

Investigar:
- rotas de marketing/pricing
- componentes PriceTable/Pricing
- modelos Prisma relacionados a plano/subscription/billing
- recursos que podem ser Free vs Pro
- locais onde a UI menciona Pro, preço, verificação ou destaque
- riscos de vender confiança sem querer
- impacto de Destaque Local em ranking/discovery
- como fazer gating server-side no futuro

Retornar relatório com:
1. arquivos lidos
2. o que já existe
3. o que não existe
4. riscos
5. proposta de arquitetura de planos
6. proposta de entitlements
7. proposta de schema, se necessário, mas sem implementar
8. fases incrementais
9. o que Composer Fast pode executar depois
```

---

## 14. Checklist anti-erro para monetização

Antes de qualquer tarefa de monetização, confirmar:

```text
[ ] Estou mexendo em UI estática ou billing real?
[ ] Existe schema atual para planos?
[ ] Precisa de migration?
[ ] Vitor autorizou migration?
[ ] Algum recurso pago afeta Trust Score?
[ ] Algum recurso pago afeta Ranking?
[ ] O texto promete selo automático?
[ ] O texto promete mais confiança por pagar?
[ ] Destaque Local está separado de ranking orgânico?
[ ] Gating sensível está no servidor?
[ ] Há audit para mutation de plano?
[ ] Não inseri secrets em código/documentos?
[ ] Rodei typecheck/lint/build?
```

---

## 15. Resumo final para o próximo agente

A monetização da Peteen deve seguir esta lógica:

```text
Tutor: grátis
Profissional Free: grátis
Profissional Pro: R$29,90/mês
Destaque Local: R$19,90/mês, somente elegíveis
Parceiros: R$99 a R$299/mês
Take rate: zero no MVP
```

Mas a regra mais importante é:

```text
Peteen vende ferramentas e operação.
Peteen não vende confiança falsa.
```

O profissional paga para organizar melhor seu trabalho, entender seus clientes, usar agenda, CRM, analytics e talvez ganhar exposição elegível.

Ele não paga para comprar reputação, avaliação, recorrência, recomendação ou posição orgânica.

Toda implementação de monetização deve proteger a tese central:

> Confiança deve ser difícil de ganhar, fácil de perder e impossível de comprar.
