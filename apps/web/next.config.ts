import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Host do Supabase Storage, derivado de `NEXT_PUBLIC_SUPABASE_URL` — a MESMA
 * variável que todo o resto do projeto já usa como fonte única (ver
 * docs/BRAND_DOMAIN_PUBLIC_SURFACE.md). Sem isto, hardcoded aqui, o projeto
 * teria dois lugares para atualizar numa troca de projeto Supabase, e um
 * deles inevitavelmente ficaria esquecido.
 *
 * `remotePatterns` (não `domains`, que está deprecado) é exigido pelo Next
 * para QUALQUER host externo passar pelo otimizador embutido — sem isto,
 * `/_next/image?url=<host-supabase>` responde 400 mesmo com a URL válida.
 */
function supabaseStorageHostname(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return undefined
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

const nextConfig: NextConfig = {
  // Fix workspace root when multiple lockfiles exist in parent dirs.
  // Ensures CSS/Tailwind tracing resolves from apps/web, not the monorepo root.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  images: {
    remotePatterns: supabaseStorageHostname()
      ? [
          {
            protocol: "https",
            hostname: supabaseStorageHostname()!,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  experimental: {
    serverActions: {
      // Default do Next.js é 1MB — abaixo do limite de 5MB que a própria
      // aplicação já valida e anuncia para foto de pet (ver
      // lib/storage/pet-photo-signature.ts). Fotos reais de celular entre
      // 1MB e 5MB eram rejeitadas pelo framework antes mesmo de
      // uploadPetPhotoAction rodar — 6MB dá folga para o overhead do
      // multipart/form-data acima do próprio arquivo de 5MB.
      bodySizeLimit: "6mb",
    },
  },

  /**
   * Cabeçalhos de segurança — auditoria BRAND/DOMAIN/LEGAL/PUBLIC SURFACE.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * O QUE NÃO ESTÁ AQUI, DE PROPÓSITO
   *
   * Nenhum CSP (Content-Security-Policy). Definir um exige listar toda origem
   * externa legítima (Supabase, Google Fonts se houver, domínio de imagem de
   * parceiro/avatar, PostHog, Google Maps) e testar cada fluxo que carrega
   * recurso de fora — errar uma entrada QUEBRA a aplicação silenciosamente
   * para quem usa aquele recurso. Isso é mudança ampla e arriscada o
   * suficiente para exigir relato e aprovação antes, não fazer parte de uma
   * auditoria de superfície pública. Fica registrado como P1 pré-piloto.
   *
   * Nenhum HSTS explícito: a Vercel já aplica Strict-Transport-Security em
   * todo domínio (próprio e customizado) na borda, antes de chegar aqui —
   * duplicar é redundante, não mais seguro.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * O QUE ESTÁ AQUI — e por que é seguro sem levantar CSP
   *
   * Os quatro cabeçalhos abaixo não dependem de conhecer origens externas:
   * são regras sobre COMO o navegador trata a própria resposta, não sobre O
   * QUE ela pode carregar. Confirmado antes de adicionar: nenhum <iframe> em
   * uso no código (busca completa em app/modules/components), então recusar
   * ser enquadrado por outro site não quebra nada nosso.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede o navegador de tentar "adivinhar" um content-type
          // diferente do declarado (ex.: tratar um upload de usuário como
          // script executável). Sem efeito colateral conhecido.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nenhuma página deste produto precisa ser exibida dentro de um
          // <iframe> de outro site — nem nós enquadramos ninguém. Bloqueia
          // clickjacking sem custo, já que a situação que impediria (uso
          // legítimo de iframe) não existe hoje.
          { key: "X-Frame-Options", value: "DENY" },
          // Envia a origem completa só para requisições dentro do próprio
          // site; para destinos de terceiros (imagem de parceiro, link
          // externo), envia só a origem — nunca o path completo, que pode
          // conter um id de request ou token na query string.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restringe o uso de câmera/microfone/geolocalização por PADRÃO do
          // navegador a este próprio origin — nenhum destes é usado hoje;
          // documentado explicitamente em vez de deixar o padrão do
          // navegador (que costuma ser mais permissivo) decidir por omissão.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
