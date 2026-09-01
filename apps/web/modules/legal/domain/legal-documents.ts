/**
 * Módulo: legal
 * Camada: domain — estrutura e conteúdo dos documentos legais públicos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DUAS FASES CONVIVEM NESTE ARQUIVO
 *
 * Uma seção com `pendente: true` não tem texto ainda — a página renderiza um
 * aviso inequívoco de "documento em elaboração" no lugar do corpo (ver
 * legal-document-page.tsx). Uma seção com `pendente: false` carrega `blocos`
 * reais e é isso que a página imprime.
 *
 * `documentoVigente(doc)` — true só quando TODAS as seções do documento
 * deixaram de ser pendentes — controla o banner de aviso e a indexação
 * (robots) da página como um todo. Isto é o que permite a Política de
 * Privacidade ficar com conteúdo real enquanto os Termos de Uso continuam
 * pendentes, sem nenhuma seção "meio pronta" enganando quem lê.
 *
 * QUANDO O TEXTO DE /termos CHEGAR: mesmo padrão — trocar `pendente: true`
 * por `pendente: false` com `blocos`, seção por seção.
 */

export type LegalBlock =
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "lista"; itens: readonly string[] }

export type LegalSection =
  | {
      id: string
      titulo: string
      /**
       * `true` enquanto o texto vigente não existir. A página renderiza um
       * aviso visível no lugar do corpo — nunca um lorem ipsum, nunca um
       * rascunho parecendo definitivo.
       */
      pendente: true
    }
  | {
      id: string
      titulo: string
      pendente: false
      /** Conteúdo real da seção, em ordem de leitura. */
      blocos: readonly LegalBlock[]
    }

export type LegalDocument = {
  slug: "termos" | "privacidade"
  titulo: string
  descricao: string
  /** Data da última alteração de conteúdo, exibida junto ao título quando o documento tem seções publicadas. */
  ultimaAtualizacao?: string
  secoes: readonly LegalSection[]
}

const pendente = (id: string, titulo: string): LegalSection => ({
  id,
  titulo,
  pendente: true,
})

const p = (texto: string): LegalBlock => ({ tipo: "paragrafo", texto })
const lista = (itens: readonly string[]): LegalBlock => ({ tipo: "lista", itens })

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
    pendente("care-timeline", "Conteúdo do Diário de cuidado (Care Timeline)"),
    pendente("avaliacoes", "Avaliações e reputação"),
    pendente("trust", "Índice de Confiança (Trust)"),
    pendente("conduta", "Conduta proibida e uso aceitável"),
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
    "Como a Peteen coleta, usa, compartilha e protege dados pessoais de tutores, profissionais e parceiros.",
  ultimaAtualizacao: "1º de setembro de 2026",
  secoes: [
    {
      id: "controlador",
      titulo: "Quem é o controlador dos dados",
      pendente: false,
      blocos: [
        p(
          "A Peteen é a plataforma responsável por operar este aplicativo e o site associado, conectando tutores de pets a profissionais e parceiros de cuidado. Para os fins desta Política, a Peteen atua como controladora dos dados pessoais tratados no funcionamento da plataforma."
        ),
        p(
          "Qualquer dúvida, solicitação ou pedido relacionado à privacidade e ao tratamento de dados pessoais pode ser encaminhado para peteenapp@gmail.com — este é, no momento, o canal oficial de contato para assuntos de privacidade."
        ),
      ],
    },
    {
      id: "dados-coletados",
      titulo: "Dados que coletamos",
      pendente: false,
      blocos: [
        p(
          "Coletamos apenas os dados necessários para o funcionamento da plataforma e das funcionalidades que você usa. As categorias abaixo refletem o que a Peteen efetivamente trata hoje:"
        ),
        lista([
          "E-mail e identificador de autenticação — usados para criar e acessar sua conta.",
          "Nome de exibição e foto de perfil (avatar) — preenchidos e enviados por você mesmo, no onboarding ou nas configurações do seu perfil.",
          "Telefone — opcional, informado por você para facilitar o contato entre as partes.",
          "Dados de perfil de tutor — cidade, estado, bairro e, quando você permite, localização aproximada, usados para conectar você a profissionais próximos.",
          "Dados de perfil profissional — bio, cidade/bairro, raio de atendimento, tipos de serviço oferecidos, especializações, selos de verificação e informações de plano.",
          "Dados de perfil de parceiro — nome do negócio, categoria, cidade/bairro, contato, site e redes sociais, quando aplicável.",
          "Dados dos seus pets — nome, espécie, raça, sexo, data de nascimento, peso, porte, foto e observações relevantes para o atendimento.",
          "Localização — cidade, estado, bairro e, quando fornecida, coordenadas aproximadas, usadas para busca e recomendação de profissionais próximos.",
          "Solicitações e atendimentos — dados do agendamento, tipo de serviço, datas, status e observações relacionadas a cada solicitação.",
          "Agenda e disponibilidade — horários que o profissional disponibiliza na plataforma.",
          "Diário de cuidado (Care Timeline) — atualizações de texto publicadas pelo profissional durante um atendimento, incluindo fotos e vídeos enviados como parte dessa atualização.",
          "Avaliações — nota e comentário deixados pelo tutor sobre um atendimento concluído.",
          "Dados de confiança e reputação — histórico de atendimentos, avaliações e outros eventos usados para calcular o nível de confiança de um profissional na plataforma.",
          "Notificações — registro de quais notificações do seu histórico já foram lidas.",
          "Assinatura de notificações push (Web Push) — quando você ativa notificações no navegador, armazenamos as informações técnicas da assinatura (ver seção 8, Web Push).",
          "Dados técnicos de segurança e auditoria — endereço IP e informações do navegador associados a ações sensíveis, para fins de segurança e investigação de incidentes.",
          "Dados de antifraude, moderação, disputas e verificação — quando aplicável, informações usadas para analisar sinais de fraude, moderar conteúdo, tratar disputas abertas por um tutor ou verificar a identidade de um profissional ou parceiro.",
        ]),
        p(
          "A Peteen não possui, no momento, um recurso de mensagens ou chat entre usuários dentro do aplicativo — não trate esta política como cobrindo uma funcionalidade que ainda não existe."
        ),
        p(
          "Login com Google: quando você escolhe entrar com sua conta Google, a Peteen utiliza o Google exclusivamente como meio de autenticação. O único dado do Google efetivamente utilizado e armazenado pela aplicação é o e-mail associado à sua conta Google, junto com um identificador técnico necessário para vincular essa autenticação à sua conta na Peteen. Nome de exibição, foto de perfil e demais informações do seu perfil na Peteen são preenchidos por você mesmo durante o onboarding — não são copiados automaticamente da sua conta Google. A Peteen não acessa Gmail, Google Drive, Google Agenda (Calendar) ou Google Contatos, não solicita permissões de acesso a APIs sensíveis ou restritas do Google, e não armazena o token de acesso (access token) nem o token de atualização (refresh token) da sua conta Google. Depois da autenticação, sua sessão na Peteen é gerenciada pelo Supabase Auth, nosso provedor de autenticação."
        ),
      ],
    },
    {
      id: "finalidades",
      titulo: "Para que usamos os dados",
      pendente: false,
      blocos: [
        p("Usamos os dados descritos na seção anterior para as seguintes finalidades:"),
        lista([
          "Autenticação — permitir que você crie uma conta e acesse a plataforma com segurança.",
          "Criação e exibição de perfil — montar seu perfil de tutor, profissional ou parceiro e exibi-lo a outros usuários quando aplicável.",
          "Funcionamento da plataforma — operar as funcionalidades centrais do produto no seu dia a dia.",
          "Descoberta e localização — conectar tutores a profissionais e parceiros próximos.",
          "Solicitações e atendimentos — processar pedidos de serviço, do agendamento à conclusão.",
          "Agenda — exibir e gerenciar a disponibilidade informada pelo profissional.",
          "Diário de cuidado (Care Timeline) — permitir o registro e a visualização de atualizações sobre o atendimento em andamento.",
          "Reputação e confiança (Trust) — calcular e exibir indicadores de confiança e histórico de recorrência entre tutor e profissional.",
          "Notificações — informar você sobre eventos relevantes da sua conta ou dos seus atendimentos.",
          "Segurança — proteger a plataforma e as contas dos usuários contra acesso indevido.",
          "Prevenção a fraude — identificar e mitigar comportamentos fraudulentos ou abusivos.",
          "Auditoria — manter rastreabilidade de ações sensíveis realizadas na plataforma.",
          "Moderação — analisar denúncias, disputas e solicitações de verificação de identidade.",
          "Suporte — responder dúvidas, solicitações e problemas reportados por você.",
          "Cumprimento de obrigações legais ou regulatórias, quando aplicável.",
        ]),
      ],
    },
    {
      id: "base-legal",
      titulo: "Bases legais do tratamento",
      pendente: false,
      blocos: [
        p(
          "Conforme a finalidade do tratamento, os dados pessoais tratados pela Peteen poderão ter fundamento, quando aplicável, em uma ou mais das seguintes bases legais previstas na legislação de proteção de dados:"
        ),
        lista([
          "Execução de contrato ou de procedimentos preliminares relacionados ao serviço solicitado por você.",
          "Cumprimento de obrigação legal ou regulatória pelo controlador.",
          "Exercício regular de direitos em processo judicial, administrativo ou arbitral.",
          "Legítimo interesse do controlador ou de terceiros, quando aplicável e sempre observados os direitos e liberdades fundamentais do titular dos dados.",
          "Consentimento do titular, quando a legislação exigir essa base especificamente.",
        ]),
        p(
          "O enquadramento jurídico específico de cada tratamento é avaliado pela Peteen conforme a evolução do produto e poderá ser detalhado com mais precisão em atualizações futuras desta política."
        ),
      ],
    },
    {
      id: "compartilhamento",
      titulo: "Com quem compartilhamos",
      pendente: false,
      blocos: [
        p(
          "A Peteen não vende dados pessoais. Compartilhamos dados apenas com prestadores de serviço que ajudam a operar a plataforma, nos limites necessários para essa operação:"
        ),
        lista([
          "Supabase — provedor de autenticação, banco de dados e armazenamento de arquivos (fotos, vídeos e documentos) usado pela Peteen.",
          "Vercel — provedor de hospedagem da aplicação e de execução de rotinas automatizadas da plataforma.",
          "Serviços de Web Push do navegador — quando você ativa notificações push, o envio dessas notificações passa pelo serviço de push do fornecedor do seu navegador (por exemplo, o serviço usado pelo Chrome, Firefox ou Safari), conforme o funcionamento padrão do protocolo Web Push.",
        ]),
        p(
          "Também podemos compartilhar dados quando exigido por lei, ordem judicial ou autoridade competente, ou na medida necessária para proteger direitos, segurança ou integridade da plataforma, de seus usuários ou de terceiros."
        ),
        p(
          "A Peteen não utiliza, no momento, ferramentas de analytics ou publicidade de terceiros, redes sociais integradas, mapas de terceiros ou plataformas de CRM externas para tratar dados pessoais dos usuários."
        ),
      ],
    },
    {
      id: "cookies",
      titulo: "Cookies e tecnologias semelhantes",
      pendente: false,
      blocos: [
        p("A Peteen utiliza, atualmente, os seguintes cookies e identificadores técnicos:"),
        lista([
          "Cookies de sessão e autenticação — necessários para manter você conectado com segurança, geridos pelo Supabase Auth.",
          "Identificador de visita (\"visitorKey\") — um identificador aleatório, próprio da Peteen (não é um identificador de rastreamento de terceiros), usado apenas para reconhecer visitas repetidas às páginas públicas de convite de um profissional e evitar contagem duplicada da mesma visita.",
        ]),
        p(
          "No momento, a Peteen não utiliza cookies de publicidade nem cookies de analytics de terceiros. Se isso mudar no futuro, esta política será atualizada antes da mudança entrar em vigor."
        ),
      ],
    },
    {
      id: "notificacoes",
      titulo: "Notificações e comunicações",
      pendente: false,
      blocos: [
        p(
          "A Peteen pode enviar comunicações relacionadas à sua conta e ao uso da plataforma, incluindo:"
        ),
        lista([
          "E-mail de acesso (link mágico) — enviado pelo Supabase Auth para permitir que você entre na sua conta sem senha.",
          "Notificações dentro do aplicativo — sobre solicitações, atendimentos e eventos relevantes da sua conta.",
          "Notificações push pelo navegador (Web Push) — apenas se você ativar essa permissão explicitamente. Ver a seção 8, Web Push, para mais detalhes.",
        ]),
      ],
    },
    {
      id: "armazenamento",
      titulo: "Por quanto tempo armazenamos",
      pendente: false,
      blocos: [
        p(
          "Mantemos os dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta política, o funcionamento do serviço, a segurança da plataforma, a prevenção a fraudes, o cumprimento de obrigações legais ou regulatórias e o exercício regular de direitos, conforme aplicável a cada categoria de dado."
        ),
        p(
          "Determinados registros — como eventos de confiança/reputação e logs de auditoria — podem precisar ser mantidos por período mais longo por razões de integridade do sistema, segurança e prevenção a abuso. Isso não significa retenção eterna e indiscriminada de todo dado pessoal: significa que, para essas categorias específicas, a exclusão imediata poderia comprometer a confiabilidade da plataforma para outros usuários."
        ),
        p(
          "A Peteen não define, nesta versão da política, prazos fixos em dias ou anos para cada categoria de dado — essa definição está em avaliação e será detalhada em atualização futura."
        ),
      ],
    },
    {
      id: "seguranca",
      titulo: "Segurança da informação",
      pendente: false,
      blocos: [
        p("A Peteen adota, entre outras, as seguintes práticas de segurança:"),
        lista([
          "Controle de acesso a dados por regras de segurança em nível de linha (Row Level Security) no banco de dados, restringindo o que cada usuário pode ler ou alterar.",
          "Armazenamento de fotos e vídeos sensíveis (como os do Diário de cuidado) em áreas privadas de armazenamento, sem URLs públicas permanentes.",
          "Acesso a esses arquivos apenas por meio de links assinados, gerados pelo servidor e com validade limitada.",
          "Segregação de permissões entre diferentes tipos de usuário (tutor, profissional, parceiro, administrador).",
          "Registros de auditoria para ações sensíveis realizadas na plataforma.",
          "Uso de provedores de infraestrutura gerenciada (Supabase e Vercel), que mantêm suas próprias práticas de segurança de infraestrutura.",
        ]),
        p(
          "Nenhum sistema é absolutamente seguro. A Peteen trabalha para proteger os dados pessoais tratados, mas não pode garantir segurança absoluta contra qualquer incidente."
        ),
      ],
    },
    {
      id: "direitos",
      titulo: "Seus direitos como titular",
      pendente: false,
      blocos: [
        p(
          "Nos termos da legislação de proteção de dados pessoais aplicável, você pode solicitar à Peteen, conforme cabível a cada caso:"
        ),
        lista([
          "Confirmação da existência de tratamento de dados pessoais seus.",
          "Acesso aos dados pessoais que tratamos sobre você.",
          "Correção de dados incompletos, inexatos ou desatualizados.",
          "Informações sobre com quem seus dados foram compartilhados.",
          "Oposição a um tratamento realizado com base em hipótese legal que não exija seu consentimento.",
          "Eliminação de dados pessoais tratados com consentimento, quando juridicamente cabível e observadas as hipóteses legais de retenção.",
          "Demais direitos previstos na legislação de proteção de dados pessoais aplicável.",
        ]),
        p(
          "Para exercer qualquer um desses direitos, entre em contato pelo e-mail peteenapp@gmail.com. Cada solicitação será analisada individualmente conforme a legislação aplicável e as circunstâncias do caso. A Peteen ainda não possui um recurso de autoatendimento dentro do aplicativo para exclusão de conta — solicitações desse tipo, por enquanto, são tratadas por esse canal."
        ),
      ],
    },
    {
      id: "criancas",
      titulo: "Menores de idade",
      pendente: false,
      blocos: [
        p(
          "A Peteen não foi projetada especificamente para uso por crianças. Caso o tratamento de dados envolva, em algum contexto, informações relacionadas a menores de idade, esse tratamento deve observar a legislação aplicável e a responsabilidade dos pais ou responsáveis legais pelo consentimento e supervisão do uso da plataforma."
        ),
      ],
    },
    {
      id: "internacional",
      titulo: "Transferência internacional de dados",
      pendente: false,
      blocos: [
        p(
          "Os provedores de infraestrutura e serviços técnicos utilizados pela Peteen podem operar servidores e infraestrutura em diferentes localidades, inclusive fora do Brasil. Quando houver transferência internacional de dados pessoais, ela deverá observar a legislação de proteção de dados aplicável e os mecanismos adequados de proteção previstos em lei."
        ),
      ],
    },
    {
      id: "alteracoes",
      titulo: "Alterações desta política",
      pendente: false,
      blocos: [
        p(
          "Esta política pode ser atualizada conforme a evolução do produto, da legislação aplicável ou das práticas de tratamento de dados da Peteen. A data da última atualização é sempre exibida no topo desta página."
        ),
      ],
    },
    {
      id: "encarregado",
      titulo: "Encarregado de dados (DPO) e contato",
      pendente: false,
      blocos: [
        p(
          "A Peteen ainda não possui um Encarregado de Proteção de Dados (DPO) formalmente designado. Enquanto isso, qualquer solicitação, dúvida ou reclamação relacionada à privacidade e ao tratamento de dados pessoais pode ser enviada para peteenapp@gmail.com — canal provisório de privacidade da Peteen até a formalização de um encarregado."
        ),
      ],
    },
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
 * some — sem ninguém precisar lembrar de removê-lo.
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
