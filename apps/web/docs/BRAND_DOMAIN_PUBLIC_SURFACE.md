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

`apps/web/public/brand/` — assets finais em uso. `apps/web/public/brand/_raw/`
guarda os arquivos originais fornecidos, antes de qualquer processamento —
preservados para reprocessar se o material mudar, nunca referenciados
diretamente pelo código. Ícones que o Next resolve por convenção (favicon,
apple-icon, `icon`, OG) ficam em `apps/web/app/`, que é onde o framework os
procura; o resto (logos, ícones do manifest) em `public/brand/`.

### Estado atual — resolvido em 2026-08-23

| Arquivo | Local | Dimensão | Origem |
|---|---|---|---|
| `favicon.ico` | `app/` | 16/32/48 multi-res | empacotado à mão (container ICO com PNGs — sem lib nova) a partir do símbolo colorido |
| `icon.png` | `app/` | 512×512 | símbolo colorido, `_raw/Símbolo isolado = asset 2.png` |
| `apple-icon.png` | `app/` | 180×180, sem alpha | `_raw/ICONE-180-X-180-IPHOHE.png`, já vinha exato — copiado sem reprocessar |
| `opengraph-image.png` | `app/` | 1200×630 | composto: fundo `#FAFAF8` + `logo-horizontal.png` centralizado |
| `icon-192.png` / `icon-512.png` | `public/brand/` | 192×192 / 512×512 | resize do símbolo colorido, referenciados pelo manifest |
| `icon-maskable.png` | `public/brand/` | 512×512, opaco | ver nota de safe zone abaixo |
| `logo-horizontal.png` | `public/brand/` | 2172×724 (3:1), transparente | `_raw/Logo completa = asset 1.png`, cópia direta |
| `logo-simbolo.png` | `public/brand/` | 1266×1243, transparente | `_raw/Símbolo isolado = asset 2.png`, cópia direta |
| `logo-clara.png` | `public/brand/` | 1235×721, transparente | glifo branco **extraído por chroma-key** de `_raw/fundo azul.png` (fundo navy uniforme removido; nenhum traço novo desenhado) |

**Nota de safe zone do maskable:** o glifo branco de `_raw/fundo azul.png`,
redimensionado direto para 512×512, tinha **4,77% dos pixels fora da safe zone
circular** (raio 40%, padrão W3C) — as pontas das duas argolas do símbolo
seriam cortadas em launchers Android com máscara circular. Corrigido
reescalando o glifo (fator 0,9064) e recompondo centrado sobre o fundo navy
antes do resize final; verificado numericamente até **0% fora da zona**
(~78% do raio, com folga sob o limite de 80%). Não foi um ajuste visual "a
olho" — cada iteração foi medida pixel a pixel contra o círculo real.

**Limitação registrada, não bloqueante:** em 16px (o menor tamanho de
favicon), o "nó" central do símbolo — o traço que faz o glifo ser dois elos
conectados, não um infinito genérico — praticamente desaparece. Em 32px já
fica nítido. O favicon continua reconhecível por cor e forma geral; só o
detalhe mais distintivo se perde no menor tamanho.

**`AZUL-COM-BORDA.png`/`BRANCO-COM-BORDA.png`** (primeira leva de arquivos,
já descartados pelo próprio Vitor) tinham cantos arredondados e sombra
desenhados dentro da imagem — formato errado para ícone de sistema, que
aplica a própria máscara por cima. Ficou registrado aqui como o motivo de
terem sido descartados, não como um asset ainda pendente.

### Ainda sem resolver

| Item | Situação |
|---|---|
| SVGs (`logo-horizontal`, `logo-simbolo`) | Só existem como PNG. Funcional (Next `<Image>` lida bem com raster), mas não escala tão bem quanto vetor — **P2** |
| `logo-clara` do **wordmark completo** (não só o símbolo) | Só o símbolo tem versão branca. Se precisar do nome "peteen" por extenso sobre fundo escuro, falta gerar |
| `app/favicon.ico` do boilerplate do Next | **Substituído** — não é mais o do `create-next-app` |
| `public/*.svg` (`file`, `globe`, `next`, `vercel`, `window`) | Resíduo do boilerplate, sem uso — seguem aí, remoção é limpeza P2 |
| `public/images/home/` | 22 MB, 8 dos 12 arquivos sem referência — P2, não tocado nesta rodada |

### Cores dos assets novos vs. código existente — DECISÃO PENDENTE

Os arquivos entregues usam uma paleta (`#02195C` navy, `#002B97`/`#FB4F36`
símbolo) visivelmente mais saturada/escura que o que já está espalhado pelo
código: `#16244F` (nav/footer), `#E07A5F` (acento). **Nenhuma dessas cores no
código foi alterada nesta missão.** Os novos assets (ícones, OG) usam a
paleta deles própria isoladamente — não foi feita tentativa de fazer bater
com o navy/laranja existente, porque isso exigiria decidir qual dos dois
prevalece, e essa decisão não foi tomada.

Se a paleta nova for a definitiva, falta: atualizar `nav`/`footer` da home
(`app/(marketing)/page.tsx`), o `theme_color`/`background_color` do
`manifest.ts`, e a cor de destaque usada em toda a UI.

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
| `icons` | **192, 512 e 512-maskable** | ✅ resolvido em 2026-08-23 |

### Consequência da ausência de ícones — revertida

Sem `icons` de 192 e 512, o navegador não oferecia instalação do app — e como
o iOS só entrega Web Push para aplicações adicionadas à Tela de Início, push em
iPhone ficava indisponível. Com os três ícones publicados (`icon-192.png`,
`icon-512.png`, `icon-maskable.png`, seção 3), a instalação volta a funcionar.
**Falta apenas a QA física** confirmar em aparelho real — instalação em si não
foi testada em hardware, só verificada via `fetch` e inspeção de metadata no
dev server.

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

### Pegadinha real do Next 15.5: `openGraph` por segmento SUBSTITUI, não mescla

Descoberta ao publicar a `opengraph-image.png`: o Next injeta a imagem de
convenção de arquivo automaticamente **só quando o segmento não declara seu
próprio objeto `openGraph`**. Qualquer página que declare `openGraph: {...}`
no `metadata` export **substitui inteiramente** o herdado do layout pai —
inclusive `images` — mesmo sem mencionar `images` no objeto novo. Confirmado
lendo o código-fonte real de merge do Next
(`node_modules/next/dist/lib/metadata/resolve-metadata.js`,
`mergeStaticMetadata`) e comparando `/login` (sem `openGraph` próprio → herda
a imagem) com `/` antes da correção (com `openGraph` próprio → `og:image`
ausente do HTML).

**Regra para qualquer página nova que declare `openGraph` customizado:**
sempre incluir `images: ["/opengraph-image.png"]` (ou a imagem específica da
página) dentro do objeto — nunca assumir que a herança do layout cobre.
Corrigido em `app/(marketing)/page.tsx` e `app/p/[professionalId]/page.tsx`,
as duas páginas que tinham esse gap.

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
