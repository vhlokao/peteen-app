export type ModuleDefinition = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
};

export const modulesRegistry = {
  identity: {
    id: "identity",
    label: "Identity",
    description: "Autenticação, personas, roles e onboarding.",
  },
  tutors: {
    id: "tutors",
    label: "Tutors",
    description: "Perfil, preferências e jornada do tutor.",
  },
  professionals: {
    id: "professionals",
    label: "Professionals",
    description: "Perfil profissional, serviços e especializações.",
  },
  pets: {
    id: "pets",
    label: "Pets",
    description: "Perfis de pets e contexto para reputação.",
  },
  discovery: {
    id: "discovery",
    label: "Discovery",
    description: "Busca local e descoberta por densidade.",
  },
  requests: {
    id: "requests",
    label: "Requests",
    description: "Solicitações, contato e WhatsApp.",
  },
  trust: {
    id: "trust",
    label: "Trust",
    description: "Trust score, sinais e histórico reputacional.",
  },
  trustGraph: {
    id: "trust-graph",
    label: "Trust Graph",
    description: "Rede de confiança, recomendações e densidade.",
  },
  ranking: {
    id: "ranking",
    label: "Ranking",
    description: "Ranking contextual — quem é a melhor escolha neste contexto.",
  },
  reviews: {
    id: "reviews",
    label: "Reviews",
    description: "Avaliações contextuais e validação social.",
  },
  recurrence: {
    id: "recurrence",
    label: "Recurrence",
    description: "Relações duradouras e ciclos de recorrência.",
  },
  crm: {
    id: "crm",
    label: "CRM",
    description: "CRM profissional — clientes, retenção e operação.",
  },
  antifraud: {
    id: "antifraud",
    label: "Antifraud",
    description: "Detecção de fraude reputacional e redes suspeitas.",
  },
  growth: {
    id: "growth",
    label: "Growth",
    description: "Densidade local e expansão bairro → cidade.",
  },
  growthEngine: {
    id: "growth-engine",
    label: "Growth Engine",
    description: "Inteligência territorial — oferta, demanda, health score.",
  },
  partners: {
    id: "partners",
    label: "Partners",
    description: "Parceiros institucionais do ecossistema pet.",
  },
  backoffice: {
    id: "backoffice",
    label: "Backoffice",
    description: "Moderação, auditoria e gestão operacional.",
  },
} as const satisfies Record<string, ModuleDefinition>;

export type ModuleId = (typeof modulesRegistry)[keyof typeof modulesRegistry]["id"];
