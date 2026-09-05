/**
 * Módulo: identity
 * Camada: domain — de onde se chega em Configurações e para onde se volta
 * (GATE-11-ACCOUNT-SETTINGS-MOBILE-UX-001).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ESTE ARQUIVO RESOLVE
 *
 * Conta é uma tela EMPURRADA que pode ser aberta de qualquer rota: o gatilho é
 * o menu de conta, presente no avatar do header e no botão "Conta" do
 * BottomNav. No mobile ela ocupava a tela inteira e não oferecia nenhuma volta:
 *
 *   - nenhum item do BottomNav fica ativo em `/tutor/conta` — "Início" é
 *     `exact: true`, e nem `/discover` nem `/tutor/requests` casam com o
 *     caminho (o mesmo vale para o profissional);
 *   - a página não tinha botão de voltar, ao contrário de todas as outras
 *     telas empurradas do produto (detalhe da solicitação, Diário).
 *
 * Sobrava só o Back do sistema. Num PWA em tela cheia, onde não há barra de
 * navegador, isso é um beco sem saída.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE `returnTo` E NÃO `router.back()`
 *
 * `router.back()` parece a resposta óbvia e é a errada aqui, pelos dois motivos
 * que o produto já conhece:
 *
 *   1. numa entrada FRIA (link direto, atalho da Tela de Início, redirect de
 *      pós-login) não existe história interna — `back()` tira a pessoa do app,
 *      que é exatamente o "levar para rota inesperada" que a missão proíbe;
 *   2. o repo já rejeitou `back()` por perder contexto entre portais — ver o
 *      comentário em `discover/[professionalId]/BackButton.tsx`.
 *
 * O menu que abre Conta já sabe o `pathname` atual (usa-o para marcar o item
 * ativo). Ele carimba esse caminho no link, e esta função o valida. Sem
 * `returnTo`, ou com um inválido, o destino é a home da persona — sempre uma
 * rota real.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE A VALIDAÇÃO NÃO É REAPROVEITADA DE partner-portal/domain/navigation
 *
 * Aquele módulo valida contra uma ALLOWLIST fechada de telas de portal. A
 * pergunta aqui é outra e mais ampla: "esta rota pertence à área desta
 * persona?" — a resposta precisa cobrir qualquer tela de onde o menu de conta
 * pode ser aberto, que é toda a área autenticada. Uma allowlist aqui faria a
 * volta cair na home sempre que alguém criasse uma tela nova e esquecesse de
 * registrá-la — um bug silencioso e permanente.
 *
 * A regra é a fronteira que o roteamento já desenha: os prefixos de cada route
 * group. E a checagem de segurança (nada de `//host`, `://`, `javascript:`)
 * continua explícita, porque `returnTo` vem da URL e um redirect aberto é um
 * problema de segurança, não de UX.
 */

export type AccountPersona = "tutor" | "professional"

/** Home de cada persona — o destino quando não há volta confiável. */
const HOME: Record<AccountPersona, string> = {
  tutor: "/tutor",
  professional: "/professional",
}

/**
 * Prefixos que compõem a área autenticada de cada persona.
 *
 * Espelham os route groups: `(tutor)` contém `tutor`, `discover` e `me`;
 * `(professional)` contém `professional` e `requests`. Um tutor nunca volta
 * para uma rota de profissional, e vice-versa — além de ser errado, seria uma
 * navegação que termina em 404 ou em redirect de guard.
 */
const AREA: Record<AccountPersona, readonly string[]> = {
  tutor: ["/tutor", "/discover", "/me"],
  professional: ["/professional", "/requests"],
}

export function accountHomeHref(persona: AccountPersona): string {
  return HOME[persona]
}

/**
 * Caminho interno seguro?
 *
 * `returnTo` chega pela query string, então é entrada não confiável. As três
 * recusas cobrem as formas de redirect aberto: `//evil.com` (protocol-relative),
 * qualquer `esquema://`, e esquemas sem barra como `javascript:` — este último
 * não navegaria como href, mas não custa recusar na origem.
 */
function caminhoInternoSeguro(caminho: string): boolean {
  if (!caminho.startsWith("/")) return false
  if (caminho.startsWith("//")) return false
  if (caminho.includes("://")) return false
  if (/^\/+\\/.test(caminho)) return false
  return true
}

/**
 * Decodifica o que veio da query sem quebrar caminhos válidos.
 *
 * Duas passadas: um `%252F` mal-intencionado vira `%2F` e depois `/`, e a
 * checagem de segurança acontece sobre a forma FINAL — validar a codificada
 * deixaria `%2F%2Fevil.com` passar.
 */
function normalizar(valor: string | string[] | undefined): string | null {
  const bruto = Array.isArray(valor) ? valor[0] : valor
  if (!bruto) return null

  let atual = bruto.trim()
  if (!atual) return null

  for (let i = 0; i < 2; i++) {
    if (!atual.includes("%")) break
    try {
      const decodificado = decodeURIComponent(atual)
      if (decodificado === atual) break
      atual = decodificado
    } catch {
      // Sequência inválida: para de decodificar e valida o que já se tem.
      break
    }
  }

  return atual
}

/** A rota pertence à área autenticada desta persona? */
export function personaPossuiCaminho(persona: AccountPersona, caminho: string): boolean {
  const semQuery = caminho.split(/[?#]/)[0] ?? caminho
  const semBarraFinal = semQuery.replace(/\/+$/, "") || "/"
  return AREA[persona].some(
    (prefixo) => semBarraFinal === prefixo || semBarraFinal.startsWith(`${prefixo}/`)
  )
}

/**
 * Para onde o botão Voltar de Configurações leva.
 *
 * Sempre devolve uma rota real — nunca `null`, nunca uma decisão adiada para o
 * componente. Um botão de voltar que às vezes não tem destino é pior que
 * nenhum.
 */
export function resolveAccountBackHref(
  persona: AccountPersona,
  returnTo: string | string[] | undefined
): string {
  const caminho = normalizar(returnTo)
  if (!caminho) return HOME[persona]
  if (!caminhoInternoSeguro(caminho)) return HOME[persona]
  if (!personaPossuiCaminho(persona, caminho)) return HOME[persona]

  // A própria Conta como destino de volta seria um laço: sair da tela para
  // cair nela de novo. Acontece de verdade — o menu de conta pode ser aberto
  // de dentro da própria Conta.
  if (ehCaminhoDeConta(caminho)) return HOME[persona]

  return caminho
}

const CONTA_HREF: Record<AccountPersona, string> = {
  tutor: "/tutor/conta",
  professional: "/professional/conta",
}

export function accountHref(persona: AccountPersona): string {
  return CONTA_HREF[persona]
}

function ehCaminhoDeConta(caminho: string): boolean {
  const semQuery = (caminho.split(/[?#]/)[0] ?? caminho).replace(/\/+$/, "")
  return Object.values(CONTA_HREF).includes(semQuery)
}

/**
 * Link para Configurações carregando de onde a pessoa saiu.
 *
 * `currentPath` vem do `usePathname()` do menu. Quando ele não serve como
 * volta (rota de outra persona, ou a própria Conta), o link vai sem `returnTo`
 * — e o resolvedor cai na home, que é o mesmo resultado, sem sujar a URL.
 */
export function buildAccountHrefComRetorno(
  persona: AccountPersona,
  currentPath: string | null | undefined
): string {
  const destino = CONTA_HREF[persona]
  if (!currentPath) return destino
  if (!caminhoInternoSeguro(currentPath)) return destino
  if (!personaPossuiCaminho(persona, currentPath)) return destino
  if (ehCaminhoDeConta(currentPath)) return destino

  return `${destino}?returnTo=${encodeURIComponent(currentPath)}`
}
