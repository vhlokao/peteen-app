# Pré-Piloto — Brand / Domain / Public Surface + Legal Readiness

Auditoria + implementação. **Nada commitado. Nada pushado. Nenhuma migration.**
Nenhum domínio assumido, nenhum logo inventado, nenhum texto jurídico redigido.

Fonte da verdade permanente: [`BRAND_DOMAIN_PUBLIC_SURFACE.md`](./BRAND_DOMAIN_PUBLIC_SURFACE.md).

---

## A. Domínio atual

| | |
|---|---|
| Domínio final | **NÃO DEFINIDO** — aguardando você |
| Produção | `NEXT_PUBLIC_APP_URL` no Vercel (não versionada, não legível daqui) |
| Local | `http://localhost:3000` |

## B. Hardcodes encontrados

**Nenhum.** É o achado mais importante da auditoria e o que torna a troca de
domínio barata.

- `vercel.app`: **zero ocorrências** em todo o repositório.
- Todo `https://` absoluto no código é fixture de teste, exemplo de sanitizer
  de segurança, site de parceiro (dado do usuário) ou `wa.me`.
- A dependência de domínio passa por **uma variável**, em **três pontos**:
  `app/layout.tsx` (`metadataBase`), `auth-actions.ts` (redirect de magic link
  e Google), `lib/env.ts` (validação).
- Links de convite já usam `window.location.origin` — **item 14 já estava
  satisfeito**, sem código específico de plataforma.

Única menção a um domínio hipotético: `invite-visit.test.ts` usa
`https://peteen.app/p/pro-123` como fixture. É string de teste, não
configuração — inofensiva, mas registrada.

## C. Checklist de mudança de domínio

Completo em [`BRAND_DOMAIN_PUBLIC_SURFACE.md` §2](./BRAND_DOMAIN_PUBLIC_SURFACE.md).
Resumo:

- **Repositório: nada a alterar.** Se algum passo exigir mudança de código, é
  sinal de que um hardcode entrou depois desta auditoria.
- **Vercel:** domínio + DNS + TLS + `NEXT_PUBLIC_APP_URL` + **redeploy**
  (variável `NEXT_PUBLIC_*` é embutida em build time — trocar sem rebuildar não
  faz nada).
- **Supabase:** Site URL + Redirect URLs (manter a antiga durante a transição).
- **Google OAuth:** JavaScript origins. O redirect URI aponta para o Supabase e
  normalmente **não muda**.
- **SEO:** acrescentar `sitemap`/`host` em `robots.ts`, criar `sitemap.ts`.

## D. Assets existentes

| Asset | Estado |
|---|---|
| `app/favicon.ico` | **boilerplate do `create-next-app`** — 25.931 bytes, nunca trocado |
| Logo | **não existe** — nav e footer usam texto + ponto laranja |
| Ícones PWA | **não existem** |
| OG image | **não existe** |
| `public/*.svg` | `file`, `globe`, `next`, `vercel`, `window` — resíduo do boilerplate |
| `public/images/home/` | 22 MB, 12 arquivos, **8 sem nenhuma referência** |

## E. Assets faltantes

Especificação exata (sem upscale de asset pequeno):

| Arquivo | Dimensões |
|---|---|
| `icon.png` | 512×512 |
| `icon-192.png` | 192×192 |
| `icon-maskable.png` | 512×512, safe zone 80% |
| `apple-icon.png` | 180×180, sem transparência |
| `favicon.ico` | 16/32/48 multi-resolução |
| `opengraph-image.png` | **1200×630** |
| `logo-horizontal.svg` / `logo-simbolo.svg` / `logo-clara.svg` | vetor |

Cores já no código: `#16244F` · `#E07A5F` · `#FAFAF8` · `#2C4893` · `#1A1A1A`.

## F. PWA

`name`, `short_name`, `start_url`, `display`, `theme_color` e
`background_color` estão corretos e coerentes com o tema **LIGHT** do piloto.

**`icons` está ausente — e isso bloqueia a instalação.** Consequência em
cadeia: sem instalação não há PWA; sem PWA no iOS **não há Web Push em
iPhone**. Android e desktop não dependem disso e já funcionam.

Não inventei ícones. Um PWA instalado com ícone falso é pior que um PWA não
instalável.

## G. Favicon / ícones

O favicon atual é o do boilerplate. Todos os demais formatos estão ausentes —
lista em (E).

## H. OG / share

**Implementado** (não exige asset seu):

- OG completo no root layout (`type`, `siteName`, `locale`, `title`,
  `description`) + Twitter card, herdado por toda página.
- OG próprio na home, com `canonical` relativo.
- OG próprio em `/p/[professionalId]`.

**`og:image` não foi declarado** — apontar para arquivo inexistente produziria
tag quebrada em toda a aplicação. Entra sozinho quando você subir
`opengraph-image.png`.

Duas decisões que documentei no código:

- **`noindex` + preview social não é contradição.** O WhatsApp busca a URL e lê
  as meta tags na hora; não passa pelo índice de ninguém.
- **O preview do convite é genérico de propósito.** Poderia interpolar o nome
  do profissional, mas a URL é adivinhável (basta um id), o que viraria um
  oráculo de "este id existe e chama-se X" — e previews ficam em cache nos
  servidores da Meta, fora do nosso controle.

## I. SEO / noindex

Antes: **nenhum `robots.txt`** e `noindex` em **um único lugar** do projeto.

Implementado, em duas camadas que não se substituem:

- `app/robots.ts` — `Disallow` para login, auth, onboarding, dashboard, admin,
  tutor, professional, partner, requests, discover, me, `/p/`, api.
- `lib/seo/private-area.ts` — `noindex, nofollow` aplicado aos **seis** layouts
  de área privada.

`sitemap`/`host` deliberadamente omitidos: exigiriam URL absoluta e criariam a
dependência oculta que a missão elimina.

**Verificado ao vivo:** `/login` responde `noindex, nofollow`; `/robots.txt`
serve as 13 regras.

## J. Termos · K. Privacidade

`/termos` e `/privacidade` **existem**. O 404 acabou — verificado no browser.

Estrutura em `modules/legal/domain/legal-documents.ts`: 15 seções para Termos,
14 para Privacidade, cada uma com âncora estável e `pendente: true`.

**Nenhuma linha de texto jurídico foi escrita.** A página exibe um aviso de
"Documento em elaboração" e cada seção diz "Conteúdo em elaboração" — nunca
lorem ipsum, nunca rascunho com cara de definitivo.

Trava automática: `documentoVigente()` retorna `false` enquanto houver
pendência, e as páginas ficam `noindex`. Quando o texto entrar, o aviso e o
`noindex` somem sozinhos — ninguém precisa lembrar de removê-los.

A pauta de privacidade cobre o mínimo estruturante da LGPD (controlador, dados,
finalidades, base legal, compartilhamento, direitos, DPO). **Isso é pauta para
o jurídico, não declaração de conformidade.**

## L. Auth / OAuth

Mapeado em (C). Nenhuma credencial alterada. O ponto que mais engana: o
redirect URI do Google aponta para o **Supabase**, não para nós — provavelmente
não muda na troca de domínio.

## M. Push / origem

> **TROCAR O DOMÍNIO INVALIDA AS SUBSCRIPTIONS EXISTENTES.**

Web Push é ligado à **origin**. Documentado em §6 da fonte da verdade, com uma
ressalva que exige honestidade:

A reconciliação publicada em `4237271` **não resolve sozinha** este caso. A
permissão de notificação também é por origem: no domínio novo,
`Notification.permission` volta a `default`, e o auto-repair exige `granted`
por design (para nunca disparar o prompt nativo). O usuário verá o CTA
"Ativar notificações" e precisará de **um clique**.

Esse é o comportamento correto e não deve ser contornado. O que fazer: avisar
os testadores, e conferir em `/admin/push` que as subscriptions novas aparecem
com o ambiente certo. VAPID **não** muda com o domínio.

## N. Invite links

`share-profile-button.tsx` já usa `window.location.origin`. Vira
`https://<domínio-final>/p/<id>` automaticamente. **Nada a fazer.**

## O. Mobile

Verificado ao vivo em **320px**: `/termos` sem scroll horizontal
(`scrollWidth === innerWidth === 320`), hierarquia legível, aviso de pendência
com destaque adequado. Screenshot capturado.

## P. Performance

- Home usa `next/image` — os PNGs de origem pesam ~2 MB, mas o servido é
  otimizado e redimensionado.
- Hero usa `.webp` de 63–77 KB.
- **8 arquivos sem referência em `public/images/home/`** (~16 MB de peso morto).
  Remover é seguro — **P2**, não feito para não misturar limpeza com
  configuração.
- Nenhuma superfície pública carrega dashboard.

## Q. Documentação

[`BRAND_DOMAIN_PUBLIC_SURFACE.md`](./BRAND_DOMAIN_PUBLIC_SURFACE.md) criado
como fonte da verdade permanente: domínio, checklist de troca, assets e
formatos faltantes, PWA, tabela de indexação por rota, implicações de origem no
Push, performance e política de atualização.

Memória de longo prazo atualizada: o blocker legal mudou de "rota 404" para
"blocker de conteúdo".

## R. Blockers de conteúdo

| # | Blocker | Impede o quê |
|---|---|---|
| 1 | **Texto jurídico de Termos e Privacidade** | Abrir ao público. As rotas existem e declaram a pendência |
| 2 | **Ícones PWA (192/512/maskable)** | Instalação do app → **e Web Push em iPhone** |
| 3 | **Domínio final** | Configuração de Vercel/Supabase/Google |
| 4 | Logo e OG image | Marca própria em vez de texto; preview com imagem no WhatsApp |
| 5 | Favicon real | Hoje é o do boilerplate do Next |

## S. Depende de você

1. **Domínio** — comprar/definir. Aí eu rodo o checklist §2.
2. **Texto jurídico** — substituo em `legal-documents.ts`; aviso e `noindex`
   somem sozinhos.
3. **Assets** — na especificação de (E). Com eles: `public/brand/`, `icons` no
   manifest, `opengraph-image`, favicon real, boilerplate removido.

---

## Classificação

| Achado | Classe | Estado |
|---|---|---|
| `/termos` e `/privacidade` 404 | P1 | ✅ rotas criadas |
| Links legais quebrados no login | P1 | ✅ resolvido + adicionados no footer e na Conta |
| Sem `robots.txt`, áreas privadas indexáveis | P1 | ✅ resolvido |
| Sem OG — preview vazio no WhatsApp | P1 | ✅ metadata; falta só a imagem |
| Ícones PWA ausentes → sem push no iOS | P1 | ⬜ **depende de asset seu** |
| Texto jurídico | P1 | ⬜ **depende de você** |
| Favicon do boilerplate | P2 | ⬜ depende de asset |
| `themeColor` dark no layout (piloto é light) | P2 | ⬜ reportado |
| 16 MB de imagens sem uso | P2 | ⬜ reportado |
| `sitemap.ts` | P3 | ⬜ depende do domínio |

**Nenhum P0.** Nenhum segredo exposto, nenhum hardcode de domínio, nenhuma
superfície pública quebrada.

### Bateria

legal 11/0 · backoffice 36/0 · push 194/0 · notification-read 42/0 · invite
36/0 · active-request-sync 52/0 · request-expiry 30/0 · care-media 168/0 ·
trust-scoring 15/0 · relationship 39/0 · agenda 70/0 · typecheck limpo · lint
**0 erros** (22 warnings pré-existentes) · build ✅ · check-sensitive-data 0
críticos + varredura manual dos untracked (0 ocorrências) · `git diff --check`
limpo.

---

## Veredito

# 🟢 BRAND / DOMAIN / PUBLIC SURFACE = APTO PARA CONFIGURAÇÃO FINAL

A arquitetura está pronta para receber domínio, marca e texto sem tocar em
código. O que falta são **insumos seus**, não engenharia — e cada um está
especificado com formato e dimensão exatos.

**Ressalva:** "apto para configuração final" não é "apto para abrir ao
público". Os blockers 1 e 2 (texto jurídico e ícones PWA) são bloqueantes reais
de piloto — o segundo porque decide se haverá push em iPhone.

*Nada commitado. Nada pushado.*
