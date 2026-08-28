/**
 * Content Security Policy — construção pura da política.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É UMA FUNÇÃO PURA, SEPARADA DO MIDDLEWARE
 *
 * O middleware roda no Edge Runtime e recebe `NextRequest` — não dá para
 * testar com `node --test` sem mockar o runtime inteiro. Extraindo a
 * MONTAGEM da política (que origem entra em qual diretiva, e por quê) para
 * uma função sem I/O, os testes viram `assert.match` triviais sobre a
 * string final, e o middleware fica só fiação: gera o nonce, chama esta
 * função, aplica nos dois lados (request e response).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE Content-Security-Policy-Report-Only, E NÃO ENFORCEMENT
 *
 * Esta é a PRIMEIRA CSP do projeto. Aplicar em modo bloqueante sem antes
 * observar violações reais em produção arrisca quebrar um fluxo que a
 * auditoria de código não capturou — e o custo de errar é o app inteiro
 * parar de funcionar para o usuário real, silenciosamente. Report-Only
 * relata a mesma violação que o modo bloqueante bloquearia, sem bloquear
 * nada. Promover para enforcement é decisão separada, depois de evidência.
 *
 * Não existe endpoint de report configurado — não é infraestrutura que esta
 * missão deveria criar (§9 do briefing: "não criar infraestrutura grande só
 * para isso"). A validação nesta rodada é via console do browser e testes
 * automatizados; ligar `report-to`/`report-uri` fica para quando (e se)
 * houver onde mandar os relatórios com segurança.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O NONCE E O NEXT.JS APP ROUTER
 *
 * O App Router injeta scripts inline próprios (o payload de hidratação RSC,
 * via `self.__next_f.push(...)`) — não é código da aplicação, é o próprio
 * framework. Sem nonce nem `'unsafe-inline'`, esses scripts seriam
 * bloqueados e a hidratação quebraria inteira.
 *
 * O Next lê o nonce da própria diretiva CSP, mas da requisição — não da
 * resposta (confirmado lendo `getScriptNonceFromHeader`, chamado em
 * `app-render.js` sobre os headers de ENTRADA). Por isso o middleware
 * precisa setar o MESMO header CSP tanto no request encaminhado quanto na
 * resposta: o primeiro é o que o Next lê para nonce-ar os próprios scripts;
 * o segundo é o que o browser realmente aplica/reporta.
 *
 * A função lê o header por QUALQUER um dos dois nomes — Report-Only incluso
 * — então gerar em modo relatório já nonce-a corretamente os scripts do
 * Next, sem precisar promover para enforcement primeiro só para validar
 * isso.
 */

export type CspEnvironment = "development" | "production"

export type CspOptions = {
  /** Valor aleatório gerado por requisição (ver middleware.ts). Nunca reutilizar entre requests. */
  nonce: string
  /** Host do Supabase, derivado de NEXT_PUBLIC_SUPABASE_URL — mesma fonte única do resto do projeto. */
  supabaseHostname: string | null
  environment: CspEnvironment
}

/**
 * Uma diretiva, com a lista de fontes e o PORQUÊ de cada uma — citado no
 * comentário ao lado de cada entrada abaixo, não aqui: o valor documental
 * está em `buildCspHeaderValue`, junto da fonte que o justifica.
 */
export function buildCspHeaderValue(options: CspOptions): string {
  const { nonce, supabaseHostname, environment } = options
  const isDev = environment === "development"

  const supabase = supabaseHostname ? `https://${supabaseHostname}` : null

  const directives: Record<string, string[]> = {
    // Base restritiva — cada diretiva abaixo abre exatamente o que tem
    // consumidor comprovado (ver docs/BRAND_DOMAIN_PUBLIC_SURFACE.md e o
    // relatório da missão CSP FOUNDATION para o levantamento origem a origem).
    "default-src": ["'self'"],

    // Scripts: só os do próprio build do Next (chunks em /_next/static, mesmo
    // origin) e os inline que O PRÓPRIO NEXT gera para hidratação — nonce-ados.
    // `'strict-dynamic'` permite que esses scripts confiáveis carreguem outros
    // que o Next injeta dinamicamente (splitting de rota), sem precisar
    // nonce-ar cada um individualmente; navegadores que entendem
    // `strict-dynamic` ignoram `'self'` neste caso — por isso os dois convivem
    // (fallback para browsers antigos que não leem `strict-dynamic`).
    //
    // Zero script de terceiro: nenhum PostHog/Sentry/Maps carregado (nenhum
    // dos três tem consumidor no código — grep confirmado, nenhum import).
    // `'unsafe-eval'` SOMENTE em dev: o HMR/React Refresh do Next usa `eval`
    // internamente para aplicar módulos atualizados; produção não roda esse
    // caminho e não recebe a permissão.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],

    // `'unsafe-inline'` aqui é deliberado, não descuido — ver §11 do
    // relatório da missão. 56 arquivos usam a prop `style={{...}}` do React
    // para valor dinâmico (cor por espécie de pet, largura de barra de
    // progresso, etc.) — o React renderiza isso como atributo `style="..."`
    // literal no DOM, e não há nonce automático para isso (diferente dos
    // scripts do Next). Hash fixo não serve: o conteúdo muda por render,
    // calculado de dado real. Eliminar exigiria mover toda cor/medida
    // dinâmica para variável CSS custom property + folha nonce-ada — reescrita
    // ampla que o briefing pede explicitamente para NÃO fazer só por isto.
    // Tailwind (a maioria do CSS) já é `'self'` — arquivo de build, sem custo.
    "style-src": ["'self'", "'unsafe-inline'"],

    // `blob:` — preview local de upload ANTES de salvar (foto/vídeo do Care
    // Timeline, foto de pet: ver photo-selection.ts, pet-photo-field.tsx,
    // CarePhotoPicker.tsx — todos via `URL.createObjectURL`).
    //
    // `https:` — não é permissividade por conveniência: `Partner.logoUrl` é
    // uma URL que o PRÓPRIO PARCEIRO digita no onboarding (validada só quanto
    // a formato, nunca quanto a host — ver modules/partners/schemas). Um
    // parceiro pode colar o logo do site dele, do Instagram, de qualquer
    // lugar. Restringir a um host fixo quebraria esse preview HOJE, para
    // dado real já em produção. `https:` nunca permite `http:` nem
    // `javascript:` como valor de `src`.
    "img-src": ["'self'", "blob:", "https:"],

    // next/font/google baixa a fonte em BUILD TIME e serve do próprio bundle
    // (/_next/static/media/...) — nunca busca fonts.googleapis.com em
    // runtime. Confirmado: nenhum <link> para fonts.googleapis.com/gstatic no
    // código. `font-src 'self'` é suficiente; adicionar o host do Google
    // seria abrir uma origem sem consumidor real.
    "font-src": ["'self'"],

    // Supabase: auth client-side (onAuthStateChange/signOut em
    // lib/supabase/auth-provider.tsx fazem fetch direto para
    // <projeto>.supabase.co/auth/v1/...). Sem Realtime (nenhum `.channel()`
    // no código — grep confirmado) — não precisa de `wss:`.
    "connect-src": ["'self'", ...(supabase ? [supabase] : [])],

    // Vídeo do Care Timeline: <video src> aponta para signed URL do Supabase
    // Storage (CareVideoPlayer.tsx) — mesmo host de connect-src. `blob:`
    // cobre o preview local de vídeo antes do upload (CarePhotoPicker.tsx).
    "media-src": ["'self'", "blob:", ...(supabase ? [supabase] : [])],

    // Registro do Service Worker (lib/push/client.ts, SW_PATH = "/sw.js") —
    // mesmo origin, nada externo.
    "worker-src": ["'self'"],

    // /manifest.webmanifest é rota do próprio app (app/manifest.ts).
    "manifest-src": ["'self'"],

    // Nenhum <iframe> no produto (auditado na missão de security headers) e
    // OAuth do Google é redirect TOP-LEVEL via Server Action (`redirect()`),
    // nunca popup nem iframe — confirmado lendo signInWithGoogle. Sem
    // consumidor, sem abertura: `frame-src 'none'`.
    "frame-src": ["'none'"],

    // Mesma decisão de X-Frame-Options: DENY já publicada — ninguém pode nos
    // enquadrar, e a CSP é a camada mais atual para isso (navegadores que
    // suportam os dois usam esta em vez daquela).
    "frame-ancestors": ["'none'"],

    // Nenhum uso de <base> dinâmico em lugar nenhum do código.
    "base-uri": ["'self'"],

    // Todo Server Action posta para o mesmo origin (confirmado: nenhum
    // <form action="https://..."> externo em lugar nenhum).
    "form-action": ["'self'"],

    // Nenhum <object>/<embed>/Flash — o Next não precisa disto para nada.
    "object-src": ["'none'"],
  }

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ")
}

/** Nome do header — Report-Only enquanto a política não for promovida a enforcement. */
export const CSP_HEADER_NAME = "Content-Security-Policy-Report-Only"

/** Extrai o hostname de `NEXT_PUBLIC_SUPABASE_URL`, ou `null` se ausente/inválida. */
export function supabaseHostnameFromEnv(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}
