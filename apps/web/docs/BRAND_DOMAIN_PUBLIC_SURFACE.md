# Marca, Domínio e Superfície Pública — Fonte da Verdade

Documento permanente. Substitui memória sobre domínio, assets e configuração
externa. Atualizar aqui quando qualquer um deles mudar.

---

## 1. Domínio

| | |
|---|---|
| Domínio final | **NÃO DEFINIDO** — aguardando decisão/compra |
| Origem de produção atual | definida em `NEXT_PUBLIC_APP_URL` no Vercel (não versionada) |
| Valor local | `http://localhost:3000` (`.env.local`) |

### A propriedade mais importante deste projeto

**Não existe nenhum host de produto hardcoded no código.** Auditado por
varredura completa: zero ocorrências de `vercel.app`; todo `https://` absoluto
é fixture de teste, exemplo de sanitizer de segurança, site de parceiro
(dado do usuário) ou `wa.me`.

A dependência de domínio passa por **uma variável só**, em **três pontos**:

| Arquivo | Uso |
|---|---|
| `app/layout.tsx` | `metadataBase` — resolve canonical, `og:url`, `og:image` |
| `modules/identity/infrastructure/auth-actions.ts` | `redirectTo` do magic link e do Google OAuth |
| `lib/env.ts` | validação do schema |

Links de convite **não usam a variável**: `share-profile-button.tsx` monta a URL
com `window.location.origin`, então já acompanha qualquer domínio
automaticamente, sem código específico de plataforma.

---

## 2. Checklist de troca de domínio

Executar **em ordem**. Os itens externos (2–4) precisam estar prontos **antes**
do corte, senão o login quebra no instante em que o domínio virar.

### Dentro do repositório
- [ ] **Nada a alterar no código.** Confirmado por auditoria. Se algum item
      abaixo exigir mudança de código, é sinal de que um hardcode foi
      introduzido depois desta auditoria — procurar antes de contornar.

### Vercel
- [ ] Adicionar o domínio no projeto (Settings → Domains)
- [ ] Configurar DNS conforme instrução da Vercel (A / CNAME)
- [ ] Aguardar emissão do certificado TLS
- [ ] Atualizar `NEXT_PUBLIC_APP_URL` para `https://<domínio>` no ambiente
      **Production**
- [ ] **Redeploy** — `NEXT_PUBLIC_*` é embutida no bundle em build time;
      trocar a variável sem rebuildar não tem efeito nenhum
- [ ] Decidir sobre o host antigo: redirect 308 para o novo, ou manter os dois

### Supabase (Authentication → URL Configuration)
- [ ] **Site URL** → `https://<domínio>`
- [ ] **Redirect URLs** → adicionar `https://<domínio>/auth/callback`
- [ ] Manter a URL antiga na allowlist durante a transição; remover depois
- [ ] Conferir templates de e-mail que usem `{{ .SiteURL }}`

### Google Cloud Console (OAuth 2.0 Client)
- [ ] **Authorized JavaScript origins** → `https://<domínio>`
- [ ] **Authorized redirect URIs** → o callback do Supabase
      (`https://<projeto>.supabase.co/auth/v1/callback`) — normalmente **não
      muda**, porque o Google redireciona para o Supabase, não para nós
- [ ] Tela de consentimento: domínio autorizado e links de política

### SEO
- [ ] Acrescentar `sitemap` e `host` em `app/robots.ts` (hoje omitidos de
      propósito — ver o comentário no arquivo)
- [ ] Criar `app/sitemap.ts` com as rotas públicas
- [ ] Google Search Console: verificar propriedade do domínio novo

### Pós-corte
- [ ] Testar: magic link, Google OAuth, senha
- [ ] Testar: compartilhar `/p/<id>` e conferir o preview no WhatsApp
- [ ] Testar: `/termos` e `/privacidade` respondendo
- [ ] Push: ver a seção 6 abaixo — **exige atenção especial**

---

## 3. Assets de marca

### Fonte canônica

`apps/web/public/brand/` — **ainda não existe**. Criar quando os arquivos
finais chegarem. Ícones que o Next resolve por convenção (favicon, apple-icon,
`icon`) ficam em `apps/web/app/`, que é onde o framework os procura; o resto
(logos, OG) em `public/brand/`. Não duplicar entre as duas.

### O que existe hoje

| Asset | Estado |
|---|---|
| `app/favicon.ico` | **Boilerplate do `create-next-app`** — 25.931 bytes, idêntico ao padrão. Nunca foi trocado |
| Logo | **Não existe.** Nav e footer usam texto "Peteen" + um ponto laranja (`#E07A5F`) |
| Ícones PWA | **Não existem** — ver seção 5 |
| OG image | **Não existe** |
| `public/*.svg` | `file`, `globe`, `next`, `vercel`, `window` — resíduo do boilerplate, sem uso |
| `public/images/home/` | 22 MB, 12 arquivos; **8 deles não são referenciados por nada** |

### O que falta você fornecer

| Arquivo | Formato | Dimensões | Para quê |
|---|---|---|---|
| `icon.png` | PNG | **512×512** | PWA + fallback geral |
| `icon-192.png` | PNG | **192×192** | PWA Android |
| `icon-maskable.png` | PNG | **512×512**, safe zone central de 80% | Ícone adaptativo Android |
| `apple-icon.png` | PNG | **180×180**, sem transparência | Tela de Início iOS |
| `favicon.ico` | ICO | 16/32/48 multi-resolução | Aba do navegador |
| `opengraph-image.png` | PNG/JPG | **1200×630** | Preview de WhatsApp/redes |
| `logo-horizontal.svg` | SVG | — | Nav, footer, e-mails |
| `logo-simbolo.svg` | SVG | quadrado | Usos compactos |
| `logo-clara.svg` | SVG | — | Sobre fundo escuro (`#16244F`) |

**Não faça upscale.** Se só houver um asset pequeno, o correto é gerar os
tamanhos a partir do vetor, não esticar um PNG.

### Cores já usadas no código

`#16244F` (azul escuro, nav/footer) · `#E07A5F` (laranja, acento) ·
`#FAFAF8` (fundo claro, `theme_color`) · `#2C4893` (azul de link) ·
`#1A1A1A` (texto).

---

## 4. PWA

`app/manifest.ts` — servido em `/manifest.webmanifest`.

| Campo | Valor | Estado |
|---|---|---|
| `name` | Peteen — Infraestrutura de confiança para serviços pet | OK |
| `short_name` | Peteen | OK |
| `start_url` | `/dashboard` | OK — sem sessão, redireciona para `/login` |
| `display` | `standalone` | OK |
| `theme_color` / `background_color` | `#FAFAF8` | OK — tema do piloto é **LIGHT** |
| `icons` | **ausente** | 🔴 **BLOQUEIA A INSTALAÇÃO** |

### Consequência real da ausência de ícones

Sem `icons` de 192 e 512, o navegador **não oferece instalação** do app. E como
o iOS só entrega Web Push para aplicações adicionadas à Tela de Início,
**push em iPhone permanece indisponível** enquanto os ícones não existirem.
Android e desktop não dependem de instalação e já funcionam.

Isto não é uma limitação a contornar com ícones inventados: um PWA instalado
com ícone falso é pior que um PWA não instalável.

**Nota:** `app/layout.tsx` ainda declara um `themeColor` para
`prefers-color-scheme: dark` (`#1A1F2E`). O piloto é light-only. Não foi
removido nesta missão para não mexer em superfície visual sem necessidade —
registrar como P2.

---

## 5. Superfície pública e indexação

| Rota | Pública? | Indexável? |
|---|---|---|
| `/` | sim | **sim** — única do produto |
| `/termos`, `/privacidade` | sim | só quando o texto for o vigente (automático) |
| `/p/[professionalId]` | sim | **não** — link pessoal, `noindex` |
| `/partners/[slug]` | sim | sim |
| `/login`, `/auth/*` | sim | **não** |
| `/onboarding`, `/dashboard`, `/tutor/*`, `/professional/*`, `/partner/*`, `/admin/*` | não | **não** |

Duas camadas, que fazem coisas diferentes e não se substituem:

- `app/robots.ts` → `Disallow` pede para **não rastrear**
- `lib/seo/private-area.ts` → `noindex, nofollow` impede de **indexar**,
  aplicado nos layouts das seis áreas privadas

---

## 6. Push e origem — atenção na troca de domínio

> **TROCAR O DOMÍNIO INVALIDA AS SUBSCRIPTIONS DE PUSH EXISTENTES.**

Web Push é ligado à **origin**. Uma subscription criada em
`https://a.exemplo` não vale em `https://b.exemplo` — são origens diferentes
para o browser, e nada migra sozinho.

O que acontece concretamente no corte:

- o Service Worker é registrado por origem: no domínio novo é uma instalação
  nova, sem subscription;
- as linhas de `push_subscriptions` do domínio antigo continuam ativas no banco
  e apontam para endpoints que continuam válidos **no push service** — elas não
  morrem sozinhas, e não vão devolver 404/410;
- o dispatcher continuará tentando enviar para elas. O usuário só receberá
  enquanto ainda tiver o site antigo instalado/aberto.

### Estratégia — já está implementada

A reconciliação de saúde publicada em `4237271` resolve isto sem código novo:
no domínio novo, `permission` continua `granted` (permissão é por origem, mas
o usuário concede de novo sem prompt visível se já concedeu… **não** — ver
abaixo), o `PushHealthReconciler` detecta ausência de subscription e re-registra.

**Ressalva honesta:** a permissão de notificação também é por origem. No
domínio novo, `Notification.permission` volta a `default`, então o
auto-repair **não** pode agir sozinho (ele exige `granted`, por design, para
nunca disparar o prompt nativo). O usuário verá o estado `DISABLED` com o CTA
"Ativar notificações" e precisará de **um clique**.

Isso é o comportamento correto e não deve ser contornado. O que fazer:

- [ ] Avisar os testadores do piloto que precisarão reativar notificações uma
      vez após a troca
- [ ] Depois do corte, conferir em `/admin/push` que subscriptions novas estão
      aparecendo com o ambiente correto
- [ ] Considerar revogar em lote as subscriptions da origem antiga (não
      implementado; só faz sentido depois que o domínio antigo sair do ar)

VAPID **não muda** com o domínio: as chaves não são ligadas à origem. O
`vapidKeyFingerprint` das subscriptions novas continuará batendo.

---

## 7. Performance da superfície pública

- Home usa `next/image`, que otimiza sob demanda — os PNGs de origem pesam
  ~2 MB cada, mas o que chega ao usuário é redimensionado e convertido.
- O hero usa `.webp` já otimizado (63–77 KB), via `background-image`.
- **8 arquivos em `public/images/home/` não são referenciados por nada**
  (~16 MB). Ficam no repositório e no deploy sem uso. Remover é seguro —
  P2, não feito nesta missão para não misturar limpeza com configuração.

---

## 8. Política de atualização

- Trocou domínio → atualizar a seção 1 e rodar o checklist da seção 2
- Chegaram assets → criar `public/brand/`, atualizar a seção 3, preencher
  `icons` no manifest, remover os SVGs do boilerplate
- Texto jurídico pronto → substituir as seções em
  `modules/legal/domain/legal-documents.ts`; o aviso de pendência e o
  `noindex` somem sozinhos
- Nova rota pública → decidir indexação e registrar na tabela da seção 5
