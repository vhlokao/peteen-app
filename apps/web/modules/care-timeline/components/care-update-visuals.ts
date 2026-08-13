/**
 * Módulo: care-timeline
 * Camada: components — apresentação compartilhada entre as DUAS superfícies
 * da timeline (resumo na Request e diário completo na rota dedicada).
 *
 * Existe para que as duas nunca divirjam: ícone e formato de horário são a
 * mesma decisão visual em ambas. O `Record<CareUpdateCategory, …>` já obriga o
 * compilador a cobrir toda categoria nova, mas o FORMATO de data não teria
 * nenhuma trava equivalente se cada componente tivesse a sua cópia — um
 * "12 de ago, 14:30" no resumo e um "12/08 14:30" no diário passariam batidos.
 *
 * Sem "use client" próprio: é consumido apenas por Client Components, que já
 * carregam a diretiva. Formatar no cliente é decisão V0 deliberada — o valor é
 * gravado em UTC e renderizado no fuso de quem lê; formatar no servidor
 * (UTC na Vercel) mostraria o horário errado para o usuário.
 */

import {
  DoorOpen,
  DoorClosed,
  UtensilsCrossed,
  Footprints,
  Sparkles,
  Moon,
  StickyNote,
  type LucideIcon,
} from "lucide-react"

import type { CareUpdateCategory } from "../domain/types"

export const CATEGORY_ICON: Record<CareUpdateCategory, LucideIcon> = {
  CHECK_IN: DoorOpen,
  FEEDING: UtensilsCrossed,
  WALK: Footprints,
  ACTIVITY: Sparkles,
  REST: Moon,
  NOTE: StickyNote,
  CHECK_OUT: DoorClosed,
}

export function formatCareUpdateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
