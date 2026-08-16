import type { LucideIcon } from "lucide-react"
import {
  Inbox,
  CheckCircle2,
  Star,
  Scale,
  ShieldCheck,
  ThumbsUp,
  Link2,
  Flag,
  EyeOff,
  UserPlus,
  XCircle,
  Bell,
  AlertTriangle,
  PawPrint,
  PlayCircle,
} from "lucide-react"

import type { NotificationType } from "../domain/types"

export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  request_received: Inbox,
  request_accepted: CheckCircle2,
  // Ícone distinto do aceite/conclusão de propósito: os três aparecem juntos
  // na mesma lista quando o atendimento avança, e repetir CheckCircle2 nos
  // três faria a central parecer três vezes o mesmo evento.
  request_started: PlayCircle,
  request_completed: CheckCircle2,
  request_cancelled: XCircle,
  care_update: PawPrint,
  review_received: Star,
  review_pending: Star,
  dispute_opened: Scale,
  dispute_status_updated: Scale,
  verification_pending: ShieldCheck,
  verification_approved: ShieldCheck,
  recommendation_received: ThumbsUp,
  partner_recommendation_activity: Link2,
  client_recurring: UserPlus,
  risk_flag: Flag,
  review_hidden: EyeOff,
  partner_unlinked: AlertTriangle,
  admin_attention: Bell,
}

export const DEFAULT_NOTIFICATION_ICON: LucideIcon = Bell
