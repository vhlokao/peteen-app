# @Peteen/web

Frontend principal do Peteen.

Documentação do monorepo: [`../../README.md`](../../README.md)

## Desenvolvimento

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Estrutura

- `app/` — App Router (route groups por persona)
- `modules/` — domínios de negócio (vertical slices)
- `components/` — UI compartilhada + layout
- `lib/` — React Query, Zustand, motion, env
- `styles/` — design tokens
