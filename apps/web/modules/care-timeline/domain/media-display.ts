/**
 * Módulo: care-timeline
 * Camada: domain — quando uma foto do Diário deve virar placeholder.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UMA FUNÇÃO PURA PARA UMA CONDIÇÃO DE DUAS LINHAS
 *
 * O projeto não tem jsdom: um `<img>`, `naturalWidth` e o evento `error` só
 * existem no navegador. Deixar esta regra como condição inline dentro do
 * componente a tornaria verificável apenas por QA manual — e foi exatamente
 * uma lacuna assim que o gate independente encontrou (ver abaixo). Extraída,
 * ela vira `assert.equal`, no mesmo padrão de `photo-selection`,
 * `active-request-sync` e `dispute-form-state`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE O `onError` SOZINHO NÃO COBRE
 *
 * `<img onError>` só captura falhas que acontecem DEPOIS de o React hidratar e
 * anexar o handler. Uma imagem que chega no HTML do servidor e falha durante o
 * primeiro paint dispara `error` antes disso — o React não reproduz eventos
 * perdidos, então o placeholder nunca aparecia e ficava um quadro vazio.
 *
 * A leitura do estado do elemento no mount fecha essa janela: se a imagem já
 * terminou de carregar (`complete`) e não tem pixels (`naturalWidth === 0`),
 * ela falhou — independentemente de termos ouvido o evento ou não.
 *
 * `complete === false` significa "ainda carregando" (ou `loading="lazy"` fora
 * da viewport), NÃO falha: nesse caso quem decide é o `onError`, mais tarde.
 * Tratar isso como quebrado esconderia fotos boas antes de elas aparecerem.
 *
 * Nenhuma rede envolvida: é só inspeção do elemento já existente. Sem retry,
 * sem refetch — a próxima renderização pode trazer uma signedUrl nova.
 */

/** O subconjunto de HTMLImageElement que interessa. Facilita testar sem DOM. */
export type EstadoDaImagem = {
  /** true quando o carregamento terminou — com sucesso OU com falha. */
  complete: boolean
  /** 0 quando não há bitmap decodificado (falha, 404, bytes inválidos). */
  naturalWidth: number
}

/**
 * A imagem já chegou quebrada, sem que o `onError` do React tenha rodado?
 *
 * Chamada uma vez por elemento, no callback de ref (fase de commit), quando o
 * nó já está no DOM e os valores são confiáveis.
 */
export function imagemChegouQuebrada(estado: EstadoDaImagem): boolean {
  if (!estado.complete) return false
  return estado.naturalWidth === 0
}
