/**
 * Módulo: legal
 * Camada: domain — estrutura dos documentos legais públicos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE ARQUIVO NÃO CONTÉM TEXTO JURÍDICO. É PROPOSITAL.
 *
 * `/termos` e `/privacidade` são linkados pelo login desde sempre e devolviam
 * 404 — um link quebrado num ponto onde a pessoa está aceitando alguma coisa.
 * Esta missão fecha a ROTA e a ESTRUTURA; o conteúdo é redação jurídica e não
 * pode ser inventado por quem escreve o código.
 *
 * O que existe aqui é o esqueleto: quais seções cada documento precisa ter,
 * em que ordem, com que título. Cada uma carrega um marcador explícito de
 * pendência, que a página renderiza de forma inequívoca — ninguém pode
 * confundir isto com um documento vigente, nem por engano nem de má-fé.
 *
 * QUANDO O TEXTO REAL CHEGAR: substituir `pendente: true` pelo corpo do
 * documento. A estrutura, a rota, o metadata, a navegação e os links já
 * estarão prontos e testados.
 *
 * As seções abaixo seguem o mínimo que a LGPD (Lei 13.709/2018) espera de um
 * aviso de privacidade e o que um termo de uso de marketplace normalmente
 * cobre. São um ESQUELETO DE PAUTA para o jurídico, não uma afirmação de
 * conformidade.
 */

export type LegalSection = {
  /** Âncora estável — vira o `id` do heading. Não mudar depois de publicado. */
  id: string
  titulo: string
  /**
   * `true` enquanto o texto vigente não existir. A página renderiza um aviso
   * visível no lugar do corpo — nunca um lorem ipsum, nunca um rascunho
   * parecendo definitivo.
   */
  pendente: true
}

export type LegalDocument = {
  slug: "termos" | "privacidade"
  titulo: string
  descricao: string
  /** Frase única no topo, explicando o estado do documento. */
  secoes: readonly LegalSection[]
}

const pendente = (id: string, titulo: string): LegalSection => ({
  id,
  titulo,
  pendente: true,
})

export const TERMOS_DE_USO: LegalDocument = {
  slug: "termos",
  titulo: "Termos de Uso",
  descricao:
    "Condições de uso da plataforma Peteen para tutores e profissionais de cuidado pet.",
  secoes: [
    pendente("aceitacao", "Aceitação dos termos"),
    pendente("definicoes", "Definições"),
    pendente("cadastro", "Cadastro e elegibilidade"),
    pendente("papel-da-peteen", "Papel da Peteen na relação entre tutor e profissional"),
    pendente("obrigacoes-tutor", "Obrigações do tutor"),
    pendente("obrigacoes-profissional", "Obrigações do profissional"),
    pendente("agendamento", "Solicitações, agendamento e cancelamento"),
    pendente("pagamentos", "Pagamentos"),
    pendente("avaliacoes", "Avaliações e reputação"),
    pendente("conduta", "Conduta proibida"),
    pendente("responsabilidade", "Limitação de responsabilidade"),
    pendente("suspensao", "Suspensão e encerramento de conta"),
    pendente("alteracoes", "Alterações destes termos"),
    pendente("foro", "Lei aplicável e foro"),
    pendente("contato", "Contato"),
  ],
}

export const POLITICA_DE_PRIVACIDADE: LegalDocument = {
  slug: "privacidade",
  titulo: "Política de Privacidade",
  descricao:
    "Como a Peteen coleta, usa, compartilha e protege dados pessoais de tutores e profissionais.",
  secoes: [
    pendente("controlador", "Quem é o controlador dos dados"),
    pendente("dados-coletados", "Dados que coletamos"),
    pendente("finalidades", "Para que usamos os dados"),
    pendente("base-legal", "Bases legais do tratamento"),
    pendente("compartilhamento", "Com quem compartilhamos"),
    pendente("cookies", "Cookies e tecnologias semelhantes"),
    pendente("notificacoes", "Notificações e comunicações"),
    pendente("armazenamento", "Por quanto tempo armazenamos"),
    pendente("seguranca", "Segurança da informação"),
    pendente("direitos", "Seus direitos como titular"),
    pendente("criancas", "Menores de idade"),
    pendente("internacional", "Transferência internacional de dados"),
    pendente("alteracoes", "Alterações desta política"),
    pendente("encarregado", "Encarregado de dados (DPO) e contato"),
  ],
}

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  TERMOS_DE_USO,
  POLITICA_DE_PRIVACIDADE,
]

/**
 * O documento está pronto para valer como texto vigente?
 *
 * Enquanto qualquer seção estiver pendente, a resposta é `false` e a página
 * exibe o aviso de documento em elaboração. Serve de trava: no dia em que o
 * texto real entrar, esta função passa a devolver `true` sozinha e o aviso
 * some — sem ninguém precisar lembrar de removê-lo à mão.
 */
export function documentoVigente(doc: LegalDocument): boolean {
  return doc.secoes.every((s) => s.pendente !== true)
}

/** Rótulos usados em links, para não divergirem entre login, footer e conta. */
export const LEGAL_LINK_LABELS = {
  termos: "Termos de uso",
  privacidade: "Política de privacidade",
} as const

export function legalHref(slug: LegalDocument["slug"]): string {
  return `/${slug}`
}
