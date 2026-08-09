import type { MetadataRoute } from "next"

/**
 * Web App Manifest — servido pelo Next em /manifest.webmanifest.
 *
 * Rota de metadata do App Router (não um arquivo estático em public/): o Next
 * injeta o <link rel="manifest"> automaticamente, sem tocar no layout.
 *
 * ESCOPO: mínimo necessário para a fundação de push. Esta missão NÃO transforma
 * o Peteen em PWA completa — sem offline, sem cache, sem estratégia de
 * instalação.
 *
 * ÍCONES AUSENTES — DECISÃO CONSCIENTE:
 *   O projeto não possui hoje nenhum asset de ícone de aplicação (public/ tem
 *   apenas SVGs do boilerplate do Next: file/globe/next/vercel/window). Inventar
 *   PNGs falsos de 192/512 seria pior que a omissão.
 *
 *   CONSEQUÊNCIA REAL: sem ícones 192px e 512px, o app NÃO é instalável como
 *   PWA. Como o iOS só entrega Web Push para aplicações adicionadas à Tela de
 *   Início, isso significa que PUSH EM iOS PERMANECE INDISPONÍVEL até que
 *   ícones reais existam. Android e desktop não dependem de instalação e
 *   funcionam normalmente.
 *
 *   `start_url` aponta para /dashboard — rota autenticada que roteia por
 *   persona. Não expõe nada por si só: sem sessão, redireciona para /login.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peteen — Infraestrutura de confiança para serviços pet",
    short_name: "Peteen",
    description:
      "Encontre profissionais pet confiáveis e acompanhe seus atendimentos.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    background_color: "#FAFAF8",
    theme_color: "#FAFAF8",
    // icons: intencionalmente omitido — ver bloco acima.
  }
}
