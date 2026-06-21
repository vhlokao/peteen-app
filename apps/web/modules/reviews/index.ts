/** @module reviews */
export const MODULE_ID = "reviews" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Avaliações contextuais.",
};
