import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"
import {
  SERVICE_TYPE_LABELS,
  type ProfessionalProfileData,
} from "@/modules/professional/domain/types"
import { resolvePublicLocation } from "@/modules/location"
import { AvatarUploadButton } from "./AvatarUploadButton"

const NAVY = "#1D2F6F"

/**
 * Capa navy do perfil — header da página /professional/profile. Absorve o
 * que antes era um <header> simples em page.tsx (título + voltar) mais o
 * preview público (nome/cidade/serviço), unificados no mesmo componente.
 *
 * "Ver como tutor" reaproveita exatamente o mesmo link/target que antes era
 * "Ver perfil público" (buildDiscoverUrl, nova aba) — só o rótulo/visual
 * mudou. Botão de câmera agora é funcional (AvatarUploadButton) — upload
 * real via Supabase Storage.
 */
export function ProfessionalProfilePreview({ profile }: { profile: ProfessionalProfileData }) {
  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const mainService = profile.serviceTypes[0]

  return (
    <section className="relative overflow-hidden rounded-[24px] p-5" style={{ background: NAVY }}>
      <span className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-white/[.08]" />
      <span className="pointer-events-none absolute -bottom-10 -left-8 size-28 rounded-full bg-white/[.06]" />

      <div className="relative flex items-center justify-between gap-3">
        <Link
          href="/professional"
          aria-label="Voltar"
          className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-white/[.12] text-white transition-colors hover:bg-white/[.18]"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <Link
          href={buildDiscoverUrl(profile.id, { from: "professional", returnTo: "/professional/profile" })}
          target="_blank"
          className="rounded-full bg-white/[.14] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/[.2]"
        >
          Ver como tutor
        </Link>
      </div>

      <div className="relative mt-5 flex items-center gap-3.5">
        <div className="relative shrink-0">
          <Avatar className="size-16 rounded-2xl bg-white">
            {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />}
            <AvatarFallback className="rounded-2xl bg-white text-lg font-extrabold" style={{ color: NAVY }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <AvatarUploadButton
            professionalId={profile.id}
            userId={profile.userId}
            className="absolute -bottom-1 -right-1"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold text-white">{profile.displayName}</h1>
          {mainService && (
            <p className="mt-0.5 truncate text-sm text-white/70">{SERVICE_TYPE_LABELS[mainService]}</p>
          )}
          <p className="mt-0.5 truncate text-xs text-white/60">
            {resolvePublicLocation({ city: profile.city, state: profile.state }).label}
          </p>
        </div>
      </div>
    </section>
  )
}
