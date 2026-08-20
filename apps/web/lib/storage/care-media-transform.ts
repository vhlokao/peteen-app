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

/**
 * Versão de VISUALIZAÇÃO, usada pelo lightbox.
 *
 * `contain` (não `cover`): aqui a foto inteira precisa aparecer, sem recorte —
 * é a diferença entre uma miniatura de grade e olhar a evidência.
 *
 * 1600px no maior lado com qualidade 82, medido na maior foto real (4000×3000,
 * 4.682 KB):
 *
 *   1280 q75 → 104 KB      1600 q75 → 192 KB
 *   1280 q82 → 164 KB      1600 q82 → 286 KB   ← escolhido
 *   1280 q88 → 243 KB      1600 q88 → 410 KB
 *
 * O diálogo do lightbox tem no máximo ~512 CSS px de largura e 75vh de altura,
 * então 1280 já cobriria a exibição. 1600 foi escolhido pela folga de
 * pinch-zoom no celular — a tela em que alguém amplia para olhar o olho ou uma
 * etiqueta é exatamente esta — ao custo de 122 KB a mais. Ainda é 94% menor
 * que a original.
 *
 * Qualidade 82 e não 75: 88 KB de diferença compra margem contra artefato em
 * pelo de animal e em baixa luz, que é o conteúdo típico do Diário. Acima de
 * 82 o ganho visual não acompanha o custo (410 KB em q88).
 */
export const CARE_MEDIA_DISPLAY_PX = 1600
export const CARE_MEDIA_DISPLAY_QUALITY = 82

export function careMediaDisplayTransform(): CareMediaTransform {
  return {
    width: CARE_MEDIA_DISPLAY_PX,
    height: CARE_MEDIA_DISPLAY_PX,
    resize: "contain",
    quality: CARE_MEDIA_DISPLAY_QUALITY,
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
  /** Versão de visualização (1600px) para o lightbox. `null` = cai para a original. */
  displayUrl: string | null
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
 * Fonte da imagem no LIGHTBOX — versão de visualização, com queda para a
 * original.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE DEIXOU DE SER A ORIGINAL
 *
 * A primeira versão desta otimização servia a original aqui, argumentando que
 * o lightbox é a tela de evidência. O QA físico mostrou o outro lado: tocar
 * numa foto e esperar 4,7 MB parece lento, e a tela em que o usuário mais
 * espera resposta imediata é justamente a que ele abriu de propósito.
 *
 * 1600px a 82 de qualidade (286 KB medidos) é maior que qualquer exibição
 * possível dentro do diálogo — que tem no máximo ~512 CSS px de largura — e
 * sobra resolução para pinch-zoom. A "evidência" que o produto precisa
 * mostrar continua legível; a original permanece intacta no bucket para
 * quando existir uma necessidade explícita de baixá-la.
 *
 * A ORIGINAL NÃO É MAIS REQUISITADA POR PADRÃO em nenhuma superfície. Ela
 * segue sendo o que está preservado, não o que é servido.
 */
export function resolveLightboxImageSrc(urls: CareMediaUrls): string {
  return urls.displayUrl ?? urls.signedUrl
}
