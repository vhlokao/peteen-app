import type { MetadataRoute } from "next"

/**
 * Web App Manifest — servido pelo Next em /manifest.webmanifest.
 *
 * Rota de metadata do App Router (não um arquivo estático em public/): o Next
 * injeta o <link rel="manifest"> automaticamente, sem tocar no layout.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ÍCONES — RESOLVIDO NA MISSÃO Brand/Domain/Public Surface
 *
 * `icon-192.png`/`icon-512.png` vêm do símbolo colorido (fonte:
 * `public/brand/_raw/`), redimensionados com `sharp` a partir do arquivo
 * quadrado maior — sem upscale de asset pequeno.
 *
 * `icon-maskable.png` NÃO é um simples resize do ícone comum: o glifo original
 * tinha 4,77% dos pixels fora da "safe zone" circular (raio de 40% do canvas —
 * o padrão W3C para maskable icons). Fora dessa zona, um launcher Android com
 * máscara circular corta as pontas das duas argolas do símbolo. O glifo foi
 * reescalado (fator 0,9064) e recomposto centrado sobre o fundo navy antes do
 * resize final, verificado numericamente até dar 0% de pixels fora da zona
 * seguro (medição em `public/brand/icon-maskable.png`, ~78% do raio — folga
 * deliberada sob o limite de 80%).
 *
 * CONSEQUÊNCIA REAL, agora revertida: sem esses ícones o app não era
 * instalável como PWA — e como o iOS só entrega Web Push a aplicações
 * adicionadas à Tela de Início, PUSH EM iOS ficava indisponível. Com os ícones
 * publicados, a instalação passa a funcionar; falta apenas a QA física
 * confirmar em aparelho real (ver runbook de Push).
 *
 * `start_url` aponta para /dashboard — rota autenticada que roteia por
 * persona. Não expõe nada por si só: sem sessão, redireciona para /login.
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
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // `purpose: "maskable"` é o que diz ao Android para aplicar a própria
      // máscara de forma sobre este ícone específico, em vez do `any` acima —
      // os dois convivem porque servem contextos diferentes (any = ícone tal
      // qual; maskable = recortável com segurança).
      { src: "/brand/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
