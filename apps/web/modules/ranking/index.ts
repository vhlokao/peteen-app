/** @module ranking */
export const MODULE_ID = "ranking" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Ranking contextual por contexto.",
};
