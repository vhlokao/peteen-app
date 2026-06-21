/** @module requests */
export const MODULE_ID = "requests" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Solicitações, contato e WhatsApp.",
};
