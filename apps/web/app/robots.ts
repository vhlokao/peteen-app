import type { MetadataRoute } from "next"

/**
 * robots.txt — servido pelo Next em /robots.txt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O ESTADO ANTERIOR
 *
 * Não existia robots.txt, e `robots: noindex` aparecia em UM único lugar do
 * projeto (a landing de convite). Todo o resto — login, onboarding, painéis,
 * solicitações, backoffice — era, do ponto de vista de um crawler, elegível a
 * indexação. Na prática as rotas autenticadas redirecionam para /login, então
 * o vazamento de conteúdo era improvável; mas a URL em si entra no índice, e
 * `/admin/...` listado no Google é um convite a sondagem que não custa nada
 * evitar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISALLOW NÃO É noindex — POR ISSO OS DOIS EXISTEM
 *
 * `Disallow` pede ao crawler que não RASTREIE. Ele ainda pode indexar a URL se
 * ela for linkada de fora, mostrando o endereço sem conteúdo. Quem impede a
 * indexação de verdade é a meta `robots: noindex`, aplicada nos layouts das
 * áreas privadas. As duas camadas cobrem coisas diferentes e nenhuma
 * substitui a outra.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEM `sitemap` E SEM `host` DE PROPÓSITO
 *
 * Os dois exigiriam a URL absoluta de produção. Enquanto o domínio final não
 * está definido, apontá-los para o host atual criaria exatamente a dependência
 * oculta que esta missão existe para eliminar — e um sitemap com o domínio
 * errado é pior que nenhum. Ver o checklist de troca de domínio em
 * docs/BRAND_DOMAIN_PUBLIC_SURFACE.md: acrescentar as duas linhas aqui é um
 * item de lá.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Autenticação e cadastro — nada aqui é conteúdo público.
          "/login",
          "/auth/",
          "/onboarding",
          // Áreas autenticadas, por persona.
          "/dashboard",
          "/admin",
          "/tutor",
          "/professional",
          "/partner",
          "/requests",
          "/discover",
          "/me",
          // Landings de convite: link pessoal compartilhado, nunca catálogo.
          // A página já traz `robots: noindex` — isto é a segunda camada.
          "/p/",
          // Rotas de API não têm nada a oferecer a um crawler.
          "/api/",
        ],
      },
    ],
  }
}
