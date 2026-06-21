/** @module trust */
export const MODULE_ID = "trust" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Trust score e histórico reputacional.",
};
