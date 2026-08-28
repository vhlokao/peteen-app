/**
 * Camada: lib/storage — URL otimizada para foto de pet/perfil.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA REAL, MEDIDO
 *
 * Fotos de pet são aceitas até 5MB e nunca redimensionadas no upload — o
 * arquivo original inteiro é servido direto do Supabase Storage. Medido no
 * banco real: uma foto de 4.2MB sendo exibida num avatar de 46×46px na Home
 * do tutor. Em rede móvel, isso é banda desperdiçada de forma severa e pode
 * contribuir para os sintomas de carregamento visível/interrompido — o mesmo
 * componente de Avatar só revela a imagem depois que ela termina de carregar
 * por completo, então um arquivo grande demora mais para essa transição
 * completar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A SOLUÇÃO: O OTIMIZADOR EMBUTIDO DO NEXT, SEM DEPENDER DO PLANO SUPABASE
 *
 * O Supabase Storage tem transformação de imagem sob demanda, mas é recurso
 * pago/condicional ao projeto — não dá para assumir que está disponível. O
 * Next.js já resolve isso de graça: toda imagem passada por `next/image`
 * vira uma chamada a `/_next/image?url=...&w=...&q=...`, que a própria
 * Vercel processa (redimensiona, converte para AVIF/WebP quando o browser
 * aceita, cacheia no edge) — sem infraestrutura nova.
 *
 * O motivo de replicar esse contrato aqui manualmente, em vez de usar o
 * componente `<Image>` diretamente, é que a foto do pet é exibida através de
 * `AvatarImage` (base-ui), que sempre renderiza um `<img>` cru — não há como
 * trocar o componente inteiro do design system só para pets sem reabrir o
 * Avatar compartilhado por profissional/parceiro, fora do escopo deste
 * ajuste. `/_next/image?url=...` é a mesma URL que `next/image` geraria por
 * baixo dos panos; é contrato público e estável do framework, não um detalhe
 * interno.
 *
 * Exige `images.remotePatterns` liberado para o host do Supabase em
 * next.config.ts — sem isso, o endpoint responde 400 mesmo com URL válida.
 */

/**
 * Larguras aceitas — precisam bater com uma entrada de `images.imageSizes`
 * do Next (usa o padrão do framework: 16/32/48/64/96/128/256/384). O
 * otimizador REJEITA com 400 qualquer `w` fora dessa lista — `w=160`
 * respondeu `"w" parameter (width) of 160 is not allowed` no teste local
 * antes desta correção. Por isso o tipo aqui é fechado: quem chama não pode
 * inventar um número que pareça razoável e quebrar em produção.
 */
export type OptimizedImageWidth = 96 | 128

/**
 * Envolve `src` na URL do otimizador do Next, pedindo a LARGURA já com folga
 * para telas retina (o chamador passa o dobro do tamanho de exibição).
 *
 * Passa direto, sem otimizar, quando:
 *   - `src` é vazio/null — nada para otimizar;
 *   - `src` é uma URL `blob:` — arquivo local (preview de upload antes de
 *     salvar), o otimizador do Next não alcança o disco do usuário;
 *   - `src` não é do Supabase Storage — poderia ser qualquer coisa (o
 *     otimizador rejeitaria hosts fora de `remotePatterns` de qualquer jeito,
 *     e forçar a passagem por ele quebraria silenciosamente).
 */
export function buildOptimizedImageUrl(
  src: string | null | undefined,
  width: OptimizedImageWidth,
  quality = 75
): string | null {
  if (!src) return null
  if (src.startsWith("blob:") || src.startsWith("data:")) return src
  if (!src.includes("/storage/v1/object/public/")) return src

  const params = new URLSearchParams({ url: src, w: String(width), q: String(quality) })
  return `/_next/image?${params.toString()}`
}
