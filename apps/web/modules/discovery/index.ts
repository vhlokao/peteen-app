/** @module discovery */
export const MODULE_ID = "discovery" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Busca local e descoberta por densidade.",
};
