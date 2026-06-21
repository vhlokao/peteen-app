/** @module professionals */
export const MODULE_ID = "professionals" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Perfil profissional, serviços e especializações.",
};
