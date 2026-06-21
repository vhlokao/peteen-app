/** @module recurrence */
export const MODULE_ID = "recurrence" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Relações duradouras e recorrência.",
};
