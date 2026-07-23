export type PersonaRole = "tutor" | "professional" | "partner" | "admin";

export type NavItem = {
  label: string;
  href: string;
  icon?: string;
};

export type AppShellVariant = "tutor" | "professional" | "partner" | "admin" | "marketing";

export type GeoScope = {
  neighborhood?: string;
  city?: string;
  region?: string;
};

/**
 * Usuário serializado passado de Server Components para Client Components no shell.
 *
 * Regras de serialização:
 *  - Sem instâncias de Date (use string ou boolean)
 *  - Sem funções
 *  - Sem referências circulares
 *
 * primaryRole usa o formato uppercase do domínio (identity module).
 * O AppShell faz o mapping para AppShellVariant internamente.
 */
export type ShellSessionUser = {
  id: string;
  email: string;
  /** Role ativa no momento — null antes do onboarding completar */
  primaryRole: "TUTOR" | "PROFESSIONAL" | "PARTNER" | "ADMIN" | null;
  /** Todas as personas que este usuário possui */
  roles: ("TUTOR" | "PROFESSIONAL" | "PARTNER" | "ADMIN")[];
  /** Foto do perfil da persona ativa (TutorProfile/ProfessionalProfile/PartnerProfile) */
  avatarUrl?: string | null;
};
