/** @module tutors */
export const MODULE_ID = "tutors" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Perfil e jornada do tutor.",
};
