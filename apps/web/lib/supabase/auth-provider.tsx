"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./client";

type SupabaseAuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(
  null
);

type SupabaseAuthProviderProps = {
  children: ReactNode;
  /**
   * Usuário inicial passado pelo Server Component para evitar flash.
   * Obtido via createSupabaseServerClient().auth.getUser() no layout.
   */
  initialUser?: User | null;
};

export function SupabaseAuthProvider({
  children,
  initialUser = null,
}: SupabaseAuthProviderProps) {
  const supabase = createSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  return (
    <SupabaseAuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) {
    throw new Error(
      "useSupabaseAuth must be used inside <SupabaseAuthProvider>"
    );
  }
  return ctx;
}
