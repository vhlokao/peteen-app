import type { LucideIcon } from "lucide-react"
import {
  Inbox,
  CheckCircle2,
  Star,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ThumbsUp,
  Link2,
  PawPrint,
  Archive,
  UserCircle,
  EyeOff,
  Eye,
  Handshake,
  ScrollText,
  Activity,
} from "lucide-react"

import type { ActivityType } from "../domain/types"

export const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  request_created: Inbox,
  request_accepted: CheckCircle2,
  request_completed: CheckCircle2,
  review_received: Star,
  review_sent: Star,
  relationship_recurring: RefreshCw,
  verification_approved: ShieldCheck,
  verification_suspended: ShieldAlert,
  verification_reactivated: ShieldCheck,
  professional_recommended: ThumbsUp,
  pet_created: PawPrint,
  pet_archived: Archive,
  profile_updated: UserCircle,
  connection_active: Link2,
  recommendation_active: Link2,
  partner_verified: ShieldCheck,
  verification_rejected: ShieldOff,
  review_hidden: EyeOff,
  review_restored: Eye,
  partner_activated: Handshake,
  partner_deactivated: Handshake,
  admin_action: ScrollText,
}

export const DEFAULT_ACTIVITY_ICON: LucideIcon = Activity
