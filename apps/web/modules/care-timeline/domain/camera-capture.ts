/**
 * Módulo: care-timeline
 * Camada: domain — quando oferecer o fluxo "Tirar foto agora".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG FÍSICO QUE ISTO CORRIGE
 *
 * Num Android o botão de câmera apareceu; em outro, não. A detecção era
 * `matchMedia("(pointer: coarse)")` — e essa media query descreve o dispositivo
 * apontador PRIMÁRIO, não os disponíveis.
 *
 * Em qualquer Android onde o apontador primário deixa de ser o dedo, ela vira
 * `false` mesmo com a tela sensível ao toque logo ali:
 *
 *   - caneta ativa (S-Pen e equivalentes) é classificada como `fine`;
 *   - mouse Bluetooth/OTG conectado, ou modo desktop (Samsung DeX);
 *   - "Solicitar versão para computador" no Chrome, que muda o contexto.
 *
 * Confirmado empiricamente no navegador: com emulação de toque,
 * `pointer: coarse` e `any-pointer: coarse` são ambos `true` e
 * `maxTouchPoints = 5`; num desktop sem toque, os três são falsos/zero. A
 * diferença entre as duas queries só aparece quando existe MAIS DE UM
 * apontador — exatamente o caso do Android B.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A CORREÇÃO: PERGUNTAR SE EXISTE TOQUE, NÃO SE O TOQUE É O PRINCIPAL
 *
 * `any-pointer: coarse` responde "algum dos apontadores disponíveis é
 * impreciso?" — verdadeiro num Galaxy com S-Pen, num tablet com teclado
 * acoplado, num celular com mouse pareado. `navigator.maxTouchPoints > 0` é o
 * segundo sinal, independente do motor de CSS, e cobre navegadores que
 * reportem as media queries de forma inesperada.
 *
 * Qualquer um dos dois basta. Não é redundância acidental: são caminhos de
 * detecção diferentes (CSS vs API de dispositivo), e o incidente mostrou que
 * depender de um só custa o fluxo inteiro num aparelho real.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O TRADE-OFF, ASSUMIDO EXPLICITAMENTE
 *
 * Um notebook com tela sensível ao toque passa a ver os dois botões. É
 * cosmético: `capture` é ignorado nesses navegadores e "Tirar foto agora"
 * simplesmente abre o seletor de arquivos — o mesmo destino do outro botão.
 *
 * A assimetria de custo decide: não oferecer câmera num celular real é perder
 * o fluxo principal do produto durante um atendimento (foi o que aconteceu);
 * oferecer um botão a mais num notebook com toque é um item de UI redundante.
 * Preferimos errar para o lado que mantém o caminho aberto.
 *
 * NÃO usamos sniffing de user-agent: a string muda por navegador, versão e
 * modo desktop — e é justamente o modo desktop um dos suspeitos do incidente.
 */

/**
 * Sinais lidos do navegador. Agrupados num tipo para que a decisão seja pura e
 * testável sem DOM — o projeto não tem jsdom.
 */
export type SinaisDeCaptura = {
  /** `matchMedia("(any-pointer: coarse)").matches` */
  algumApontadorImpreciso: boolean
  /** `navigator.maxTouchPoints` */
  pontosDeToque: number
}

/**
 * Este aparelho deve receber o fluxo câmera-primeiro?
 *
 * Deliberadamente permissivo — ver o trade-off no cabeçalho. Nenhum dos sinais
 * é sobre TAMANHO de tela: um tablet grande em contexto de atendimento é
 * exatamente onde a câmera importa, e um celular em modo desktop tem viewport
 * larga sem deixar de ser um celular.
 */
export function deveOferecerCameraPrimeiro(sinais: SinaisDeCaptura): boolean {
  return sinais.algumApontadorImpreciso || sinais.pontosDeToque > 0
}

/**
 * A media query usada. Exportada para o componente não repetir a string e para
 * o teste poder afirmar QUAL query é consultada — trocar `any-pointer` por
 * `pointer` aqui reintroduziria o bug do Android B em silêncio.
 */
export const MEDIA_QUERY_CAPTURA = "(any-pointer: coarse)"
