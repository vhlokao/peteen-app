# Peteen

Infraestrutura de confiança recorrente para serviços pet.

O Peteen **não é um marketplace genérico**. A plataforma conecta tutores, profissionais e parceiros através de reputação contextual, recorrência e confiança verificável.

## Princípios

- Confiança não é comprada
- Recorrência > volume
- Reputação contextual
- Segurança emocional
- Crescimento por densidade local
- Antifraude como core

Documentação completa: `MASTER_CONTEXT.md`, `PRODUCT_PRINCIPLES.md`, `ENGINEERING_RULES.md`, `STACK.md`.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript (strict) |
| UI | Tailwind CSS 4 + shadcn/ui |
| Estado servidor | TanStack Query |
| Estado UI | Zustand |
| Formulários | React Hook Form + Zod |
| Animações | Framer Motion |
| Tema | next-themes (dark mode) |
| Backend (próxima fase) | Supabase + Prisma + PostgreSQL |

## Estrutura

```
apps/web/
├── app/                    # App Router — route groups por persona
│   ├── (marketing)/        # Landing
│   ├── (auth)/             # Login / onboarding
│   ├── (tutor)/            # Área do tutor
│   ├── (professional)/     # Área do profissional + CRM
│   └── (admin)/            # Backoffice
├── modules/                # Domínios de negócio (vertical slices)
│   ├── identity/
│   ├── trust/
│   ├── ranking/
│   ├── crm/
│   ├── antifraud/
│   └── ...
├── components/
│   ├── ui/                 # shadcn/ui
│   ├── layout/             # AppShell, nav
│   └── forms/
├── lib/                    # Integrações cross-cutting
├── styles/                 # Design tokens
└── types/
```

### Anatomia de um módulo

```
modules/trust/
├── domain/           # Entidades, regras de negócio
├── application/      # Use cases
├── infrastructure/   # Repositórios, eventos
├── components/       # UI do domínio
├── hooks/
├── schemas/          # Zod
└── index.ts          # API pública do módulo
```

## Setup local

### Pré-requisitos

- Node.js 20+
- npm 10+

### Instalação

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run typecheck` | Verificação TypeScript |

## Rotas iniciais

| Rota | Descrição |
|------|-----------|
| `/` | Landing |
| `/login` | Autenticação |
| `/tutor` | Dashboard tutor |
| `/professional` | Dashboard profissional |
| `/admin` | Backoffice |

## Design System

Referências: Airbnb · Stripe · Linear — adaptado ao universo pet.

Tokens customizados: `--trust`, `--success`, spacing mobile-first, shadows premium.

## Próximas fases

1. Supabase Auth (Google, Magic Link, WhatsApp)
2. Prisma schema (trust events, ranking, recorrência)
3. Trust score MVP
4. Ranking contextual básico
5. CRM profissional

## Licença

Proprietary — Peteen.
