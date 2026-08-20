/**
 * Transformação de leitura da mídia do Diário — parâmetros e regra, puros.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA MEDIDO
 *
 * A timeline renderiza cada foto numa grade de 3 colunas, ou seja, um quadrado
 * de ~96 CSS px num celular de 320–390px. As fotos reais publicadas no QA são
 * de câmera de celular: 4000×3000 px, 3,2 a 4,7 MB cada.
 *
 * Reabrir uma Request com 3 fotos baixava mais de 12 MB para desenhar três
 * quadrados de 96px. Não era latência do Storage — era volume: o navegador
 * transferia e decodificava a imagem inteira, em resolução de impressão, para
 * jogar 99,9% dos pixels fora no `object-cover`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A SOLUÇÃO NÃO CRIA ARQUIVO NOVO
 *
 * O Storage do Supabase transforma na LEITURA: a mesma URL assinada aceita
 * parâmetros de redimensionamento e devolve uma renderização derivada, servida
 * por CDN. O objeto original permanece exatamente como foi enviado — os mesmos
 * bytes, o mesmo path, o mesmo `CareMedia.storagePath`.
 *
 * Isso é o que torna esta abordagem sem migration, sem segundo objeto no
 * bucket, sem geração no cliente (que não é autoridade) e sem processamento no
 * servidor (que precisaria baixar 4,7 MB para dentro de uma função serverless).
 * E, principalmente: sem uma segunda representação que pudesse ficar órfã,
 * inconsistente ou meio-publicada — a classe de bug que este projeto já pagou
 * caro para aprender.
 *
 * Medição real, sobre as 7 fotos publicadas (ver relatório da missão):
 *   total original: 16.441 KB  →  miniaturas: ~200 KB
 *   maior foto:      4.682 KB  →         11 KB   (99,8%)
 */

/**
 * Miniatura da grade da timeline.
 *
 * 288px = 96 CSS px × 3, cobrindo telas de densidade 3x sem sobrar pixel. É
 * DELIBERADAMENTE pequena: este tamanho nunca é ampliado — tocar na foto abre
 * o lightbox, que usa a original. Qualidade 75 num quadrado de 96px é
 * indistinguível de 100 a olho nu, e é onde a maior parte da economia mora.
 *
 * `cover` (não `contain`) porque a grade já recorta com `object-cover` no CSS:
 * pedir `contain` traria barras que o CSS descartaria de qualquer forma.
 */
export const CARE_MEDIA_THUMBNAIL_PX = 288
export const CARE_MEDIA_THUMBNAIL_QUALITY = 75

export type CareMediaTransform = {
  width: number
  height: number
  resize: "cover" | "contain"
  quality: number
}

export function careMediaThumbnailTransform(): CareMediaTransform {
  return {
    width: CARE_MEDIA_THUMBNAIL_PX,
    height: CARE_MEDIA_THUMBNAIL_PX,
    resize: "cover",
    quality: CARE_MEDIA_THUMBNAIL_QUALITY,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Qual URL cada superfície usa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * As duas URLs que o DTO carrega para uma foto. `thumbnailUrl` é `null` quando
 * a assinatura da miniatura falhou — ver `resolveTimelineImageSrc`.
 */
export type CareMediaUrls = {
  signedUrl: string
  thumbnailUrl: string | null
}

/**
 * Fonte da imagem na GRADE da timeline.
 *
 * FALLBACK OBRIGATÓRIO (item 8 da missão): sem miniatura, exibe a original. A
 * consequência é uma foto pesada, não uma foto ausente — e "pesada" é
 * exatamente o comportamento que existia antes desta otimização, então o pior
 * caso desta mudança é o status quo, nunca uma regressão.
 *
 * Isto também é o que dispensa backfill: qualquer mídia já publicada continua
 * funcionando sem nenhuma alteração de dado, porque a miniatura é derivada na
 * leitura e não depende de nada gravado.
 */
export function resolveTimelineImageSrc(urls: CareMediaUrls): string {
  return urls.thumbnailUrl ?? urls.signedUrl
}

/**
 * Fonte da imagem no LIGHTBOX — sempre a original.
 *
 * O lightbox é a visualização de EVIDÊNCIA: é onde o tutor olha o pelo, o olho,
 * a etiqueta, o ambiente. Servir uma versão recomprimida aqui economizaria
 * bytes numa tela que o usuário abriu justamente para ver detalhe, e é o único
 * lugar do produto onde a qualidade original importa de verdade.
 *
 * Custo aceito e conhecido: abrir o lightbox de uma foto de 4,7 MB baixa 4,7 MB.
 * Acontece sob demanda, uma foto por vez, por escolha explícita do usuário —
 * não no carregamento da tela, que era o problema real.
 */
export function resolveLightboxImageSrc(urls: CareMediaUrls): string {
  return urls.signedUrl
}
