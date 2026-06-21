"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  /** Se true, exibe apenas o ícone (modo collapsed da sidebar) */
  collapsed?: boolean;
  className?: string;
};

export function SignOutButton({ collapsed = false, className }: SignOutButtonProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size={collapsed ? "icon" : "default"}
      onClick={handleSignOut}
      aria-label="Sair da conta"
      className={cn(
        "w-full justify-start gap-3 text-muted-foreground hover:text-destructive",
        collapsed && "justify-center",
        className
      )}
    >
      <LogOut className="size-4 shrink-0" />
      {!collapsed && <span>Sair</span>}
    </Button>
  );
}
