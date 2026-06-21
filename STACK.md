# STACK.md

# Peteen — MVP STACK

# FRONTEND

## Framework

* Next.js 15

## Linguagem

* TypeScript

## Styling

* Tailwind CSS

## UI Components

* shadcn/ui

## Formulários

* React Hook Form
* Zod

---

# BACKEND

## Backend Platform

* Supabase

## Banco de Dados

* PostgreSQL

## ORM

* Drizzle ORM

---

# AUTENTICAÇÃO

* Supabase Auth

Login inicial:

* Google
* WhatsApp
* E-mail Magic Link

---

# STORAGE

* Supabase Storage

Usado para:

* fotos de pets
* fotos de profissionais
* documentos
* imagens do sistema

---

# REALTIME

* Supabase Realtime

Possíveis usos:

* status
* notificações
* solicitações

---

# MAPAS E GEOLOCALIZAÇÃO

* Google Maps API

---

# ANALYTICS

* PostHog

---

# E-MAILS

* Resend

---

# WHATSAPP

MVP:

* Integração simples via link

Futuro:

* Evolution API
* Twilio

---

# DEPLOY

## Frontend

* Vercel

## Backend

* Supabase Cloud

---

# DESIGN SYSTEM

Referências principais:

* Airbnb
* Stripe
* Linear

Características:

* clean
* emocional
* premium
* acolhedor
* confiável

---

# MVP SCOPE

## Entram no MVP

* onboarding
* perfil profissional
* perfil tutor
* perfil pet
* trust básico
* avaliações
* recorrência
* busca local
* solicitações
* WhatsApp
* CRM básico
* dashboard profissional

---

## NÃO entram inicialmente

* IA reputacional
* machine learning
* pagamentos internos
* seguros
* recommendation engine avançado
* automações complexas
* antifraude avançado em tempo real


# Peteen — STACK.md

# STACK OFICIAL DO MVP

## FILOSOFIA TÉCNICA

A stack do Peteen deve priorizar:

* velocidade de desenvolvimento
* escalabilidade gradual
* ótima experiência de produto
* baixo custo operacional inicial
* alta velocidade de iteração
* arquitetura moderna
* facilidade de contratação futura

O objetivo do MVP NÃO é hiperescala.

O objetivo é:

* validar confiança
* validar recorrência
* validar retenção
* validar densidade local

---

# FRONTEND

## Framework

* Next.js 15 (App Router)

## Linguagem

* TypeScript

## UI

* Tailwind CSS
* shadcn/ui

## Ícones

* Lucide Icons

## Estado Global

* Zustand

## Data Fetching

* TanStack Query (React Query)

## Forms

* React Hook Form
* Zod

## Tabelas

* TanStack Table

## Animações

* Framer Motion

---

# DESIGN SYSTEM

## Referências

* Airbnb
* Stripe
* Linear

## Características

* clean
* premium
* minimalista
* emocional
* humano
* confiável

## Regras Visuais

A interface deve transmitir:

* segurança
* clareza
* confiança
* acolhimento
* profissionalismo

---

# BACKEND

## Backend Principal

* Supabase

## Banco de Dados

* PostgreSQL

## ORM

* Prisma ORM

## Auth

* Supabase Auth

## Realtime

* Supabase Realtime

## Storage

* Supabase Storage

---

# INFRAESTRUTURA

## Deploy Frontend

* Vercel

## Banco

* Supabase Cloud

## CDN

* Vercel Edge Network

---

# EMAILS

## Serviço

* Resend

## Templates

* React Email

---

# ANALYTICS

## Produto

* PostHog

Objetivo:

* entender retenção
* recorrência
* comportamento
* funis

---

# MONITORAMENTO

## Logs

* Supabase Logs

## Error Tracking

* Sentry

---

# MAPAS E GEOLOCALIZAÇÃO

## API

* Google Maps API

ou

* Mapbox

---

# UPLOADS

## Armazenamento

* Supabase Storage

Tipos:

* foto de perfil
* foto do pet
* documentos
* badges
* imagens institucionais

---

# NOTIFICAÇÕES

## MVP

* WhatsApp manual
* e-mail

## Futuro

* push notifications
* automações
* notificações inteligentes

---

# PAGAMENTOS

## MVP

Sem pagamentos internos.

---

## Futuro

* Stripe
* Mercado Pago

Possibilidades:

* assinatura
* verificação
* parceiros
* seguros
* garantias

---

# ESTRUTURA DO PROJETO

## Organização Inicial

/apps/web

Frontend principal

---

/components

Componentes reutilizáveis

---

/features

Domínios de negócio

Exemplos:

* auth
* professionals
* tutors
* pets
* trust-score
* crm
* ranking

---

/lib

Helpers e integrações

---

/services

Regras de negócio

---

/database

Schemas e queries

---

/types

Tipagens globais

---

# ESTRATÉGIA DE ARQUITETURA

A arquitetura deve seguir:

## Domain Driven Thinking

Separando:

* UI
* lógica
* domínio
* infraestrutura

---

# PRINCÍPIOS DE ENGENHARIA

## 1. Clareza acima de complexidade

Evitar overengineering.

---

## 2. Escalar somente quando necessário

O MVP precisa validar comportamento, não performance extrema.

---

## 3. Segurança primeiro

Especialmente em:

* autenticação
* reputação
* antifraude
* uploads

---

## 4. Reutilização

Criar componentes reutilizáveis desde o início.

---

## 5. Mobile First

Grande parte dos usuários utilizará mobile.

---

# MVP — ESCOPO TÉCNICO

## Tutor

* cadastro
* login
* perfil
* pets
* busca
* perfil profissional
* solicitação
* avaliações

---

## Profissional

* cadastro
* perfil
* especializações
* serviços
* agenda básica
* CRM básico
* histórico

---

## Sistema

* trust score inicial
* ranking básico
* recorrência
* antifraude básico
* backoffice mínimo

---

# FEATURES FUTURAS

## V2

* automações
* IA reputacional
* recommendation engine
* trust graph avançado
* notificações inteligentes

---

# LONGO PRAZO

O Peteen deve evoluir para:

* infraestrutura de confiança do mercado pet
* sistema operacional do profissional pet
* rede reputacional do setor
* camada de relacionamento recorrente do mercado pet
