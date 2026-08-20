import { cn } from "@/lib/utils"

/**
 * Bloco de skeleton genérico — cada tela monta o layout real com isto,
 * dimensionando via className (`h-4 w-32`, `size-16 rounded-full`, etc.).
 * Existe para as telas operacionais críticas (PRE-PILOT POLISH — CRITICAL
 * FLOW PERFORMANCE & RESILIENCE) terem loading.tsx coerente com o layout
 * real, em vez de spinner genérico de página inteira ou tela em branco.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />
}
