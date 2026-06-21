/** @module growth */
export const MODULE_ID = "growth" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Densidade local e expansão geo.",
};
