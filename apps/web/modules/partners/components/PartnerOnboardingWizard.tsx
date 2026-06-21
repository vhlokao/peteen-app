"use client"

import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, ChevronLeft, ChevronRight, Handshake, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORIES,
} from "@/modules/partners/domain/constants"
import { activationScoreLabel } from "@/modules/partners/domain/activation"
import type {
  PartnerCategory,
  PartnerOnboardingCompleteResult,
  ProfessionalOnboardingOption,
} from "@/modules/partners/domain/types"
import {
  savePartnerOnboardingBusinessAction,
  updatePartnerOnboardingBusinessAction,
  savePartnerOnboardingTrustAction,
  savePartnerOnboardingRecommendationsAction,
  completePartnerOnboardingAction,
  getProfessionalsForOnboardingAction,
} from "@/modules/partners/application/onboarding-actions"

const STEPS = ["Categoria", "Negócio", "Confiança", "Recomendações", "Ativação"]

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"

export function PartnerOnboardingWizard() {
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [category, setCategory] = useState<PartnerCategory | null>(null)

  const [businessName, setBusinessName] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [phone, setPhone] = useState("")
  const [instagram, setInstagram] = useState("")
  const [website, setWebsite] = useState("")
  const [description, setDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")

  const [yearsInBusiness, setYearsInBusiness] = useState("")
  const [hasCnpj, setHasCnpj] = useState(false)
  const [requestVerification, setRequestVerification] = useState(false)

  const [professionals, setProfessionals] = useState<ProfessionalOnboardingOption[]>([])
  const [selectedProIds, setSelectedProIds] = useState<string[]>([])
  const [loadingPros, setLoadingPros] = useState(false)

  const [result, setResult] = useState<PartnerOnboardingCompleteResult | null>(null)

  useEffect(() => {
    if (step === 3 && city.trim()) {
      setLoadingPros(true)
      getProfessionalsForOnboardingAction(city.trim())
        .then(setProfessionals)
        .finally(() => setLoadingPros(false))
    }
  }, [step, city])

  function toggleProfessional(id: string) {
    setSelectedProIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function handleNextFromCategory() {
    if (!category) {
      setError("Selecione uma categoria.")
      return
    }
    setError(null)
    setStep(1)
  }

  function handleSubmitBusiness(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const payload = {
        category: category!,
        businessName,
        city,
        state,
        phone,
        instagram: instagram || undefined,
        website: website || undefined,
        description: description || undefined,
        logoUrl: logoUrl || undefined,
      }

      const res = partnerId
        ? await updatePartnerOnboardingBusinessAction(partnerId, payload)
        : await savePartnerOnboardingBusinessAction(payload)

      if (res.ok) {
        if (!partnerId && "partnerId" in res.data) {
          setPartnerId(res.data.partnerId)
        }
        setStep(2)
        toast.success("Dados salvos!")
      } else {
        setError(res.error)
      }
    })
  }

  function handleSubmitTrust(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerId) return
    setError(null)

    startTransition(async () => {
      const res = await savePartnerOnboardingTrustAction({
        partnerId,
        yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness, 10) : undefined,
        hasCnpj,
        requestVerification,
      })

      if (res.ok) {
        setStep(3)
      } else {
        setError(res.error)
      }
    })
  }

  function handleSubmitRecommendations(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerId) return
    setError(null)

    startTransition(async () => {
      const recRes = await savePartnerOnboardingRecommendationsAction(
        partnerId,
        selectedProIds
      )
      if (!recRes.ok) {
        setError(recRes.error)
        return
      }

      const completeRes = await completePartnerOnboardingAction(partnerId)
      if (completeRes.ok) {
        setResult(completeRes.data)
        setStep(4)
        toast.success("Bem-vindo à rede Peteen!")
      } else {
        setError(completeRes.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
            <p className={`mt-1 hidden text-[0.6rem] sm:block ${i === step ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Header copy */}
      {step < 4 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Handshake className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Rede Peteen</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {step === 0 && "Que tipo de parceiro é você?"}
            {step === 1 && "Conte sobre seu negócio"}
            {step === 2 && "Construa confiança na rede"}
            {step === 3 && "Quem você recomenda?"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 0 && "Clínicas, pet shops e hotéis ajudam tutores a encontrar profissionais confiáveis."}
            {step === 1 && "Essas informações aparecem no seu perfil público na rede."}
            {step === 2 && "Parceiros verificados ganham mais visibilidade no Discovery."}
            {step === 3 && "Ajude seus clientes indicando profissionais que você confia."}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {/* Step 1 — Categoria */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="grid gap-2">
            {PARTNER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  category === cat
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {PARTNER_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleNextFromCategory}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground"
          >
            Continuar <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* Step 2 — Negócio */}
      {step === 1 && (
        <form onSubmit={handleSubmitBusiness} className="space-y-4">
          <input required placeholder="Nome do negócio *" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          <div className="grid grid-cols-3 gap-2">
            <input required placeholder="Cidade *" value={city} onChange={(e) => setCity(e.target.value)} className={`col-span-2 ${inputClass}`} />
            <input required placeholder="UF *" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className={inputClass} />
          </div>
          <input required placeholder="Telefone *" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          <input placeholder="Instagram (@petshop)" value={instagram} onChange={(e) => setInstagram(e.target.value)} className={inputClass} />
          <input placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
          <input placeholder="URL do logo (opcional)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inputClass} />
          <textarea placeholder="Descrição do negócio" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(0)} className="flex items-center gap-1 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground">
              <ChevronLeft className="size-4" /> Voltar
            </button>
            <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {isPending ? "Salvando…" : "Continuar"}
            </button>
          </div>
        </form>
      )}

      {/* Step 3 — Confiança */}
      {step === 2 && (
        <form onSubmit={handleSubmitTrust} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Anos de atividade</label>
            <input type="number" min={0} max={100} placeholder="Ex: 5" value={yearsInBusiness} onChange={(e) => setYearsInBusiness(e.target.value)} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasCnpj} onChange={(e) => setHasCnpj(e.target.checked)} className="size-4 rounded" />
            Possui CNPJ
          </label>
          <label className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <input type="checkbox" checked={requestVerification} onChange={(e) => setRequestVerification(e.target.checked)} className="mt-0.5 size-4 rounded" />
            <span>
              <strong>Solicitar verificação Peteen</strong>
              <br />
              <span className="text-muted-foreground">Status: PENDING_VERIFICATION — nossa equipe analisará seu cadastro.</span>
            </span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground">
              <ChevronLeft className="size-4" /> Voltar
            </button>
            <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {isPending ? "Salvando…" : "Continuar"}
            </button>
          </div>
        </form>
      )}

      {/* Step 4 — Recomendações */}
      {step === 3 && (
        <form onSubmit={handleSubmitRecommendations} className="space-y-4">
          {loadingPros ? (
            <p className="text-sm text-muted-foreground">Carregando profissionais em {city}…</p>
          ) : professionals.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum profissional encontrado em {city}. Você pode concluir e adicionar recomendações depois pelo admin.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
              {professionals.map((pro) => (
                <label
                  key={pro.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors ${
                    selectedProIds.includes(pro.id) ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedProIds.includes(pro.id)}
                    onChange={() => toggleProfessional(pro.id)}
                    className="size-4 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{pro.displayName}</p>
                    <p className="text-xs text-muted-foreground">{pro.city} · Trust {pro.trustScore.toFixed(0)}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="flex items-center gap-1 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground">
              <ChevronLeft className="size-4" /> Voltar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isPending ? "Ativando…" : selectedProIds.length > 0 ? "Concluir e entrar na rede" : "Entrar na rede sem recomendações"}
            </button>
          </div>
        </form>
      )}

      {/* Step 5 — Sucesso */}
      {step === 4 && result && (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-bold">Você agora faz parte da rede Peteen!</h1>
            <p className="text-sm text-muted-foreground">
              {result.partner.businessName} está ativo e pronto para recomendar profissionais confiáveis.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-left">
            <MetricRow label="Profissionais recomendados" value={result.recommendationCount} />
            <MetricRow label="Trust connections criadas" value={result.connectionsCreated} />
            <MetricRow
              label="Nível de ativação"
              value={`${result.activationScore}% (${activationScoreLabel(result.activationScore)})`}
            />
            {result.partner.verificationStatus === "PENDING_VERIFICATION" && (
              <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <Sparkles className="size-3.5" />
                Verificação solicitada — em análise pela equipe Peteen.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-left text-sm">
            <p className="font-medium">Próximos passos</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>Compartilhe seu perfil público com clientes</li>
              <li>Adicione mais recomendações quando conhecer novos profissionais</li>
              <li>Complete logo e descrição para subir seu nível de ativação</li>
            </ul>
          </div>

          <Link
            href={`/partners/${result.partner.slug}`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground"
          >
            Ver meu perfil público
          </Link>
        </div>
      )}
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}
