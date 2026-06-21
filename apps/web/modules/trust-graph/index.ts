/** @module trust-graph */
export const MODULE_ID = "trust-graph" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Rede de confiança e recomendações.",
};
