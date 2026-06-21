/** @module identity */
export const MODULE_ID = "identity" as const;

export type ModuleMeta = {
  readonly id: typeof MODULE_ID;
  readonly description: string;
};

export const meta: ModuleMeta = {
  id: MODULE_ID,
  description: "Autenticação, personas, roles e onboarding.",
};

// Domain types
export type { PersonaRole, SessionUser, AuthContext, AuthProvider } from "./domain/types";

// Application
export { getAuthContext, requireAuth, requireRole } from "./application/get-session";

// Infrastructure
export { syncSupabaseUser, getUserByAuthId } from "./infrastructure/sync-user";

// Components
export { LoginForm } from "./components/login-form";
