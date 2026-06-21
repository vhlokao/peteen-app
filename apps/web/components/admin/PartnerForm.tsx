"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createPartnerAction,
  updatePartnerAction,
} from "@/modules/partners/application/actions"
import {
  PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABELS,
} from "@/modules/partners/domain/constants"
import type { Partner, PartnerCategory, CreatePartnerInput } from "@/modules/partners/domain/types"
import { generatePartnerSlug } from "@/modules/partners/domain/slug"

type Props = {
  partner?: Partner
  onDone?: () => void
}

export function PartnerForm({ partner, onDone }: Props) {
  const router = useRouter()
  const isEdit = Boolean(partner)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState(partner?.businessName ?? "")
  const [slug, setSlug] = useState(partner?.slug ?? "")
  const [category, setCategory] = useState<PartnerCategory>(
    partner?.category ?? "PET_SHOP"
  )
  const [city, setCity] = useState(partner?.city ?? "")
  const [state, setState] = useState(partner?.state ?? "")
  const [description, setDescription] = useState(partner?.description ?? "")
  const [phone, setPhone] = useState(partner?.phone ?? "")
  const [website, setWebsite] = useState(partner?.website ?? "")
  const [instagram, setInstagram] = useState(partner?.instagram ?? "")
  const [logoUrl, setLogoUrl] = useState(partner?.logoUrl ?? "")
  const [isVerified, setIsVerified] = useState(partner?.isVerified ?? false)

  function handleNameChange(val: string) {
    setBusinessName(val)
    if (!isEdit && !slug) {
      setSlug(generatePartnerSlug(val))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!businessName.trim() || !city.trim() || !state.trim()) {
      setError("Nome, cidade e estado são obrigatórios.")
      return
    }

    const payload: CreatePartnerInput = {
      businessName: businessName.trim(),
      slug:         slug.trim() || undefined,
      category,
      city:         city.trim(),
      state:        state.trim(),
      description:  description.trim() || undefined,
      phone:        phone.trim() || undefined,
      website:      website.trim() || undefined,
      instagram:    instagram.trim() || undefined,
      logoUrl:      logoUrl.trim() || undefined,
      isVerified,
    }

    startTransition(async () => {
      const result = isEdit && partner
        ? await updatePartnerAction(partner.id, payload)
        : await createPartnerAction(payload)

      if (result.ok) {
        const message = isEdit
          ? "Parceiro atualizado com sucesso!"
          : "Parceiro criado com sucesso!"
        toast.success(message)
        setSuccess(message)
        onDone?.()
        router.refresh()
        if (!isEdit) {
          setBusinessName("")
          setSlug("")
          setCity("")
          setState("")
          setDescription("")
          setPhone("")
          setWebsite("")
          setInstagram("")
          setLogoUrl("")
          setIsVerified(false)
        }
      } else {
        setError(result.error ?? "Erro ao salvar")
      }
    })
  }

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Nome do negócio <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Pet Shop Central"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="pet-shop-central"
            className={`${inputClass} font-mono text-xs`}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Categoria <span className="text-destructive">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PartnerCategory)}
            className={inputClass}
          >
            {PARTNER_CATEGORIES.map((c) => (
              <option key={c} value={c}>{PARTNER_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Cidade <span className="text-destructive">*</span>
          </label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} required />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Estado <span className="text-destructive">*</span>
          </label>
          <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} required />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Telefone</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Website</label>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Instagram</label>
          <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@petshop" className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Logo URL</label>
          <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inputClass} />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="isVerified"
            checked={isVerified}
            onChange={(e) => setIsVerified(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <label htmlFor="isVerified" className="text-sm text-foreground">
            Parceiro verificado pelo Peteen
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
          ✓ {success}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar parceiro"}
      </button>
    </form>
  )
}
