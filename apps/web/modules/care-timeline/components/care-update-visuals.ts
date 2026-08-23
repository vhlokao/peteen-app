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
 * carregam a diretiva.
 *
 * CORREÇÃO — "renderiza no fuso de quem lê" não se sustentava:
 *   A intenção original era formatar no cliente, no fuso do aparelho. Só que
 *   Client Component também é renderizado no SERVIDOR para gerar o HTML
 *   inicial. Sem `timeZone` explícito, o Intl usava o fuso do runtime — UTC na
 *   Vercel no servidor, BRT no aparelho depois da hidratação. O MESMO nó
 *   produzia "19:05" no HTML e "16:05" após hidratar: mismatch silencioso, e
 *   horário errado em qualquer instante em que o cliente ainda não assumiu.
 *
 *   O fuso agora é injetado pelo helper central (`formatEventInstant`), então
 *   servidor e browser produzem a mesma string. É o mesmo fuso fixo que o
 *   restante do contrato temporal já adota.
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

import { formatEventInstant } from "@/lib/date/zoned-datetime"
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
  return formatEventInstant(new Date(date), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
