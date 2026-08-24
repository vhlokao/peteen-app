/**
 * Módulo: care-timeline
 * Camada: domain — orientação e proporção de exibição da mídia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É DOMÍNIO, E NÃO CSS NO COMPONENTE
 *
 * "Qual a forma deste card?" é decisão de produto, não de estilo: define se a
 * Care Timeline comunica um registro de cuidado ou um arquivo anexado. Estando
 * aqui, a regra é testável sem montar React — e o componente vira fiação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PORTRAIT-FIRST
 *
 * O padrão real observado é gravação mobile vertical: os vídeos do QA físico
 * são 1080x1920. A V0.1 assumia 16/9 no card fechado, então o tutor via um card
 * deitado que, ao tocar, virava um vídeo em pé — parecia outro objeto, não o
 * mesmo conteúdo expandindo.
 *
 * Agora a forma fechada segue a orientação real, e o fallback (sem metadata) é
 * vertical, porque é o caso dominante.
 */

/**
 * Teto de sanidade das dimensões informadas pelo cliente.
 *
 * 10000px cobre com folga qualquer câmera de celular (8K tem 7680px de lado) e
 * ainda barra valores absurdos que só poderiam vir de erro ou manipulação.
 */
export const DIMENSAO_MAXIMA = 10_000

/**
 * Proporções dos cards FECHADOS.
 *
 * Vertical usa 4:5, NÃO a proporção real 9:16. É deliberado: 9:16 numa coluna
 * de 390px daria ~636px de altura — praticamente a tela inteira para um vídeo
 * que ninguém abriu ainda. 4:5 comunica "isto é vertical" sem dominar o feed, e
 * abrir para 9:16 continua sendo expansão na MESMA orientação, que é o ponto.
 */
export const PROPORCAO_FECHADA_VERTICAL = 4 / 5
export const PROPORCAO_FECHADA_HORIZONTAL = 16 / 9
export const PROPORCAO_FECHADA_QUADRADA = 1

export type OrientacaoMidia = "VERTICAL" | "HORIZONTAL" | "QUADRADA"

/**
 * Uma dimensão é utilizável como hint de layout?
 *
 * Estes valores NÃO são dado de segurança — são informados pelo cliente e no
 * máximo produzem um card com a forma errada. Por isso a checagem é de
 * SANIDADE, não de autenticidade: inteiro, positivo e dentro de um teto
 * plausível. Nada aqui participa de autorização, MIME, tamanho ou posse.
 */
export function dimensaoUtilizavel(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    valor <= DIMENSAO_MAXIMA
  )
}

/**
 * Normaliza um par de dimensões para persistência.
 *
 * Tudo-ou-nada de propósito: uma largura válida com altura inválida não
 * descreve proporção nenhuma, e guardar metade do par convidaria um cálculo
 * com `undefined` mais adiante. Falhou uma, as duas viram null e a mídia cai no
 * fallback — que é um resultado correto, só menos preciso.
 */
export function normalizarDimensoes(
  width: unknown,
  height: unknown
): { displayWidth: number; displayHeight: number } | null {
  if (!dimensaoUtilizavel(width) || !dimensaoUtilizavel(height)) return null
  return { displayWidth: width, displayHeight: height }
}

/** Orientação a partir das dimensões de exibição. `null` quando desconhecida. */
export function orientacaoDeMidia(
  displayWidth: number | null | undefined,
  displayHeight: number | null | undefined
): OrientacaoMidia | null {
  if (!dimensaoUtilizavel(displayWidth) || !dimensaoUtilizavel(displayHeight)) {
    return null
  }
  if (displayHeight > displayWidth) return "VERTICAL"
  if (displayWidth > displayHeight) return "HORIZONTAL"
  return "QUADRADA"
}

/**
 * Proporção do card FECHADO.
 *
 * Sem metadata cai em vertical — nunca de volta ao 16/9. Voltar ao horizontal
 * por omissão reproduziria exatamente o problema que a V0.2 corrige, e para a
 * mídia legada deste piloto (dois vídeos, ambos 9:16) o palpite vertical é o
 * correto.
 */
export function proporcaoFechada(
  displayWidth: number | null | undefined,
  displayHeight: number | null | undefined
): number {
  switch (orientacaoDeMidia(displayWidth, displayHeight)) {
    case "HORIZONTAL":
      return PROPORCAO_FECHADA_HORIZONTAL
    case "QUADRADA":
      return PROPORCAO_FECHADA_QUADRADA
    default:
      return PROPORCAO_FECHADA_VERTICAL
  }
}

/**
 * Proporção do player ABERTO — a real do arquivo, quando conhecida.
 *
 * `null` significa "ainda não sei": o componente mantém a forma fechada até o
 * elemento reportar `videoWidth/videoHeight`. Nunca montar vídeo escondido só
 * para descobrir isso — o contrato de rede da V0.1 (zero request antes do
 * clique) vale mais que um card com a forma exata.
 */
export function proporcaoAberta(
  displayWidth: number | null | undefined,
  displayHeight: number | null | undefined
): number | null {
  if (!dimensaoUtilizavel(displayWidth) || !dimensaoUtilizavel(displayHeight)) {
    return null
  }
  return displayWidth / displayHeight
}
