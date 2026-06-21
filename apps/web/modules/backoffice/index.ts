/** @module backoffice */
export const MODULE_ID = "backoffice" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Moderação e auditoria.",
};
