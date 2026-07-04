# Política de contas — Demo, QA, Multirole e Admin

Este documento define como as contas do Peteen devem ser organizadas para
demonstrações, testes e operação administrativa, evitando a mistura de
personas que gerou risco de segurança e de imagem no ambiente de
desenvolvimento (ver missões "Security Audit" e "Demo Data Cleanup").

Nenhuma credencial, e-mail pessoal, token ou segredo é listado aqui.

## Contas demo

- Uma role de negócio por conta (TUTOR **ou** PROFESSIONAL **ou** PARTNER —
  nunca mais de uma, e nunca ADMIN).
- Dados curados: nomes, bios, preços e textos revisados, sem conteúdo de
  teste (`"dadasdasd"`, caixa alta, valores absurdos, etc.).
- Únicas contas usadas em apresentações, screenshots, gravações e testes
  com usuários externos.
- Nunca reaproveitar uma conta de QA como conta demo sem antes higienizar
  todos os dados visíveis dessa conta.

## Contas QA

- Podem ter estados estranhos, dados extremos, histórico "sujo" e textos de
  teste — isso é esperado e útil para achar bugs.
- **Nunca** são usadas em demonstração, screenshot, gravação ou apresentação
  externa.
- Podem ter múltiplas contas por persona (ex: `testeprofissional2`,
  `testeprofissional3`) para exercitar cenários variados sem contaminar a
  conta demo oficial.

## Conta multirole

- Existe exclusivamente para testar autorização entre personas (guards,
  redirects, isolamento de área) — não para servir de vitrine.
- Não é usada como conta demo, mesmo que os dados dela sejam razoáveis.
- Só deve ser criada quando houver necessidade real de teste multirole;
  não criar preventivamente.

## Conta admin

- Exclusiva para administração — **nunca** possui persona de negócio
  (TutorProfile, ProfessionalProfile ou PartnerProfile).
- Criada via mecanismo próprio do Supabase Auth (Admin API), nunca por
  inserção direta em `public.users` sem o Auth user correspondente.
- Toda ação administrativa relevante é rastreada em `AdminAuditLog`
  (ações de moderação/backoffice) e/ou `AuditLog` (ações sobre entidades de
  domínio, como disputas e reviews).

## Conta pessoal

- E-mails pessoais de membros da equipe (ex: o e-mail do fundador) **nunca**
  entram no dataset de demonstração, mesmo que a conta tenha dados reais de
  uso.
- Não devem aparecer em screenshots, gravações, apresentações, exports
  compartilhados ou credenciais entregues a testadores externos.
- Qualquer role administrativa numa conta pessoal é uma decisão separada,
  avaliada caso a caso — não é removida automaticamente por esta política.

## Sincronização Supabase Auth → banco da aplicação

O projeto tem um trigger no Postgres (`on_auth_user_created`, `AFTER INSERT
ON auth.users`, executando a função `handle_new_user()`) que sincroniza
automaticamente `auth.users` → `public.users` assim que uma conta é criada
no Supabase Auth — a linha criada é "bare" (sem `activePrimaryRole`, sem
`onboardingCompletedAt`).

Consequência prática: **qualquer script administrativo que crie usuários
via Admin API deve gravar o `User` da aplicação com `upsert` por `authId`,
nunca com `create` puro** — um `create` puro colide com a linha que o
trigger já inseriu, mesmo que a criação do Auth user e a gravação do
Prisma pareçam sequenciais no seu código (ver
`scripts/create-isolated-admin.mjs`).

## Checklist antes de qualquer demonstração externa

1. Confirmar que a conta usada não tem role ADMIN além da conta admin
   dedicada.
2. Confirmar que a conta usada não é um e-mail pessoal de alguém da equipe.
3. Confirmar que os textos visíveis (nome, bio, serviços, preços, reviews)
   já passaram pelo lote de saneamento correspondente.
4. Confirmar que nenhuma tela acessível pela conta demo expõe dado de outra
   conta de QA por engano.
