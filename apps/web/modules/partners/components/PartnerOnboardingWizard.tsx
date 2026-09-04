"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Handshake,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/forms/form-field"
import {
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORIES,
} from "@/modules/partners/domain/constants"
import { activationScoreLabel } from "@/modules/partners/domain/activation"
import { formatBrazilianPhone } from "@/modules/partners/domain/phone-format"
import { validarDadosDoNegocio } from "@/modules/partners/schemas"
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

/**
 * Altura mínima de alvo de toque (44px = `min-h-11`).
 *
 * O `Input` do design system é `h-8` (32px) e o `Button size="lg"` é `h-9`
 * (36px) — ambos abaixo do mínimo confortável num funil preenchido quase todo
 * no celular. `min-h-11` já é a convenção do projeto para isto (ver
 * CarePhotoPicker e CareMediaGallery); não é medida inventada aqui.
 */
const ALVO_TOQUE = "min-h-11"

/** Iniciais para o fallback do logo — no máximo duas, como no partner-portal. */
function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (partes.length === 0) return "?"
  return partes
    .map((p) => p[0]!)
    .join("")
    .toUpperCase()
}

export function PartnerOnboardingWizard() {
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})

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
  /** O endereço informado falhou ao carregar — some o preview, entra o fallback. */
  const [logoQuebrado, setLogoQuebrado] = useState(false)

  const [yearsInBusiness, setYearsInBusiness] = useState("")
  const [hasCnpj, setHasCnpj] = useState(false)
  const [requestVerification, setRequestVerification] = useState(false)

  /**
   * A verificação JÁ foi solicitada de verdade nesta sessão.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * O BUG QUE ISTO FECHA
   *
   * A etapa Confiança exibia, fixo dentro do rótulo do checkbox, o texto
   * "Status: PENDING_VERIFICATION". Não era estado derivado de coisa alguma:
   * era string literal, visível com o checkbox DESMARCADO — a tela anunciava
   * uma solicitação que não existia.
   *
   * O inverso também era alcançável, e é o mais grave. Pelo botão Voltar de
   * Recomendações dá para retornar aqui DEPOIS de já ter solicitado. O
   * checkbox reaparecia marcado e desmarcável — só que
   * `updatePartnerOnboardingTrust` é ADITIVO: o bloco que grava
   * `verificationRequestedAt` só roda quando `requestVerification` é true, e
   * nada nunca o apaga. Desmarcar e reenviar não revogava nada. A UI oferecia
   * uma escolha que o backend não tem como honrar.
   *
   * Por isso, uma vez solicitada, a caixa dá lugar a um estado informativo: é
   * a única leitura que corresponde ao que o servidor faz.
   *
   * Derivado do resultado do próprio submit, e não de consulta nova: este
   * wizard cria o Partner na mesma sessão (a capability é emitida logo após
   * `createPartnerOnboarding`), então não existe solicitação pendente que ele
   * não tenha feito. Uma query aqui só confirmaria o que já se sabe.
   */
  const [verificacaoSolicitada, setVerificacaoSolicitada] = useState(false)

  const [professionals, setProfessionals] = useState<ProfessionalOnboardingOption[]>([])
  const [selectedProIds, setSelectedProIds] = useState<string[]>([])
  const [loadingPros, setLoadingPros] = useState(false)
  /** Falha da busca — distinto de "buscou e não achou ninguém". */
  const [erroBusca, setErroBusca] = useState<string | null>(null)

  const [result, setResult] = useState<PartnerOnboardingCompleteResult | null>(null)

  /**
   * Busca os profissionais da cidade.
   *
   * Separado do efeito para que o botão "Tentar de novo" chame exatamente a
   * mesma coisa — um retry que percorre um caminho diferente do original é um
   * retry que pode "funcionar" sem provar nada.
   */
  const buscarProfissionais = useCallback(async () => {
    const cidade = city.trim()
    if (!cidade) return

    setLoadingPros(true)
    setErroBusca(null)
    const res = await getProfessionalsForOnboardingAction(cidade)
    if (res.ok) {
      setProfessionals(res.data)
    } else {
      // Não zera a lista: se uma busca anterior deu certo, um erro no retry não
      // deve apagar da tela profissionais que continuam válidos.
      setErroBusca(res.error)
    }
    setLoadingPros(false)
  }, [city])

  useEffect(() => {
    if (step === 3) void buscarProfissionais()
  }, [step, buscarProfissionais])

  /**
   * Some com o erro de UM campo assim que ele é editado.
   *
   * Sem isto o aviso fica na tela depois de corrigido: o parceiro digita um
   * nome válido e continua lendo "Nome deve ter ao menos 2 caracteres" até
   * tentar enviar de novo. É a mesma classe de defeito que esta missão veio
   * consertar na etapa Confiança — texto que não corresponde ao estado — e
   * seria irônico reintroduzi-la aqui.
   *
   * Só APAGA, nunca acusa: validar a cada tecla marcaria de vermelho um campo
   * que a pessoa ainda está terminando de preencher. O erro volta no próximo
   * submit, se ainda for o caso.
   */
  function limparErro(campo: string) {
    setErros((prev) => {
      if (!prev[campo]) return prev
      const resto = { ...prev }
      delete resto[campo]
      return resto
    })
  }

  function toggleProfessional(id: string) {
    setSelectedProIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function handleNextFromCategory() {
    if (!category) {
      setError("Selecione uma categoria para continuar.")
      return
    }
    setError(null)
    setStep(1)
  }

  function handleSubmitBusiness(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validacao = validarDadosDoNegocio({
      category,
      businessName,
      city,
      state,
      phone,
      instagram,
      website,
      description,
      logoUrl,
    })
    if (!validacao.ok) {
      setErros(validacao.erros)
      return
    }
    setErros({})

    startTransition(async () => {
      const payload = {
        category: category!,
        businessName: businessName.trim(),
        city: city.trim(),
        state: state.trim(),
        phone: phone.trim(),
        instagram: instagram.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
      }

      const res = partnerId
        ? await updatePartnerOnboardingBusinessAction(payload)
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

    // Se já foi solicitada, não se pede de novo: `requestVerification` é
    // idempotente do lado do servidor, mas repetir geraria uma segunda linha
    // de auditoria para um evento que aconteceu uma vez só.
    const pedirAgora = requestVerification && !verificacaoSolicitada

    startTransition(async () => {
      const res = await savePartnerOnboardingTrustAction({
        partnerId,
        yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness, 10) : undefined,
        hasCnpj,
        requestVerification: pedirAgora,
      })

      if (res.ok) {
        if (pedirAgora) setVerificacaoSolicitada(true)
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
      const recRes = await savePartnerOnboardingRecommendationsAction(selectedProIds)
      if (!recRes.ok) {
        setError(recRes.error)
        return
      }

      const completeRes = await completePartnerOnboardingAction()
      if (completeRes.ok) {
        setResult(completeRes.data)
        setStep(4)
        toast.success("Bem-vindo à rede Peteen!")
      } else {
        setError(completeRes.error)
      }
    })
  }

  const logoInformado = logoUrl.trim() !== ""

  return (
    <div className="space-y-6">
      {/* Progresso — a barra é decorativa; quem não a enxerga recebe o mesmo
          conteúdo pelo texto abaixo. O rótulo por etapa some abaixo de `sm`
          por falta de espaço; o resumo textual existe justamente aí. */}
      <div className="space-y-2">
        <div className="flex gap-1" aria-hidden>
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
              <p
                className={`mt-1 hidden text-[0.6rem] sm:block ${
                  i === step ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[0.7rem] text-muted-foreground sm:sr-only" aria-live="polite">
          Etapa {step + 1} de {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      {/* Cabeçalho */}
      {step < 4 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Handshake className="size-5" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">Rede Peteen</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {step === 0 && "Que tipo de parceiro é você?"}
            {step === 1 && "Conte sobre seu negócio"}
            {step === 2 && "Construa confiança na rede"}
            {step === 3 && "Quem você recomenda?"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 0 &&
              "Clínicas, pet shops e hotéis ajudam tutores a encontrar profissionais confiáveis."}
            {step === 1 && "Essas informações aparecem no seu perfil público na rede."}
            {step === 2 && "Parceiros verificados ganham mais visibilidade no Discovery."}
            {step === 3 && "Ajude seus clientes indicando profissionais que você confia."}
          </p>
        </div>
      )}

      {/* Erro da ação — `role="alert"` para o leitor de tela anunciar sem
          depender de o foco chegar aqui, e ícone para não depender só da cor. */}
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* ── Etapa 1 — Categoria ────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Grupo de rádio de verdade: sete botões independentes não
              comunicam "escolha uma", e o leitor de tela não anuncia quantas
              opções existem nem qual está ativa. */}
          <div role="radiogroup" aria-label="Categoria do negócio" className="grid gap-2">
            {PARTNER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={category === cat}
                onClick={() => setCategory(cat)}
                className={`flex ${ALVO_TOQUE} items-center rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  category === cat
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {PARTNER_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="lg"
            onClick={handleNextFromCategory}
            className={`w-full ${ALVO_TOQUE} gap-2`}
          >
            Continuar <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}

      {/* ── Etapa 2 — Negócio ──────────────────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={handleSubmitBusiness} noValidate className="space-y-4">
          <FormField name="businessName" label="Nome do negócio *" error={erros.businessName}>
            {(field) => (
              <Input
                {...field}
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value)
                  limparErro("businessName")
                }}
                autoComplete="organization"
                className={ALVO_TOQUE}
              />
            )}
          </FormField>

          <div className="grid grid-cols-3 gap-2">
            <FormField name="city" label="Cidade *" error={erros.city} className="col-span-2">
              {(field) => (
                <Input
                  {...field}
                  value={city}
                  onChange={(e) => {
                  setCity(e.target.value)
                  limparErro("city")
                }}
                  autoComplete="address-level2"
                  className={ALVO_TOQUE}
                />
              )}
            </FormField>
            <FormField name="state" label="UF *" error={erros.state}>
              {(field) => (
                <Input
                  {...field}
                  value={state}
                  onChange={(e) => {
                  setState(e.target.value.toUpperCase())
                  limparErro("state")
                }}
                  maxLength={2}
                  autoComplete="address-level1"
                  autoCapitalize="characters"
                  className={`${ALVO_TOQUE} uppercase`}
                />
              )}
            </FormField>
          </div>

          {/* Telefone — GATE-8-PARTNER-INPUT-MASKS-001: máscara BR própria de
              Partner (formatBrazilianPhone), decisão específica deste gate
              que substitui o texto-livre que o produto usa em outro lugar
              (Professional/Tutor não foram tocados). `type="tel"` +
              `autoComplete="tel"` seguem o mesmo contrato de sempre;
              `inputMode="tel"` abre o teclado numérico no celular. O valor
              exibido/armazenado já sai formatado — o schema (ver
              modules/partners/schemas/index.ts) aceita pontuação, então
              nenhuma conversão extra é feita no submit. */}
          <FormField
            name="phone"
            label="Telefone *"
            error={erros.phone}
            description="Como tutores e a equipe Peteen falam com você."
          >
            {(field) => (
              <Input
                {...field}
                value={phone}
                onChange={(e) => {
                  setPhone(formatBrazilianPhone(e.target.value))
                  limparErro("phone")
                }}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                className={ALVO_TOQUE}
              />
            )}
          </FormField>

          <FormField name="instagram" label="Instagram" error={erros.instagram}>
            {(field) => (
              <Input
                {...field}
                value={instagram}
                onChange={(e) => {
                  setInstagram(e.target.value)
                  limparErro("instagram")
                }}
                placeholder="@seupetshop"
                autoCapitalize="none"
                autoCorrect="off"
                className={ALVO_TOQUE}
              />
            )}
          </FormField>

          <FormField name="website" label="Website" error={erros.website}>
            {(field) => (
              <Input
                {...field}
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value)
                  limparErro("website")
                }}
                type="url"
                inputMode="url"
                placeholder="https://seupetshop.com.br"
                autoCapitalize="none"
                autoCorrect="off"
                className={ALVO_TOQUE}
              />
            )}
          </FormField>

          {/* Logo — endereço de imagem, não upload.
              O upload direto (escolher arquivo do celular) é o que este campo
              deveria ser, e NÃO foi implementado nesta missão de propósito:
              exige bucket próprio + RLS para um autor ANÔNIMO, o que é gate de
              storage. Está no relatório. O que dá para fazer sem gate é o
              preview abaixo — que mostra na hora se o endereço colado funciona,
              em vez de deixar a descoberta para o perfil público. */}
          <FormField
            name="logoUrl"
            label="Logo do negócio"
            error={erros.logoUrl}
            description="Cole o endereço da imagem — do seu site ou do seu Instagram."
          >
            {(field) => (
              <Input
                {...field}
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value)
                  setLogoQuebrado(false)
                  limparErro("logoUrl")
                }}
                type="url"
                inputMode="url"
                placeholder="https://…/logo.png"
                autoCapitalize="none"
                autoCorrect="off"
                className={ALVO_TOQUE}
              />
            )}
          </FormField>

          {/* Preview — mesmo desenho do partner-portal (Avatar arredondado +
              iniciais no fallback), para que o parceiro veja aqui o que verá
              lá. `object-cover` num quadrado evita a logo esticada. */}
          {(logoInformado || businessName.trim() !== "") && (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
              {/* `rounded-xl` precisa ir nos TRÊS: o root, a imagem e o anel
                  `after:` trazem `rounded-full` da base do design system, então
                  arredondar só o root deixaria a logo circular dentro de uma
                  caixa quadrada, com um aro redondo por cima. */}
              <Avatar className="size-14 shrink-0 rounded-xl after:rounded-xl">
                {logoInformado && (
                  <AvatarImage
                    src={logoUrl.trim()}
                    alt=""
                    className="rounded-xl"
                    /* `onLoadingStatusChange`, e NÃO `onError`: o base-ui
                       intercepta o erro da <img> para trocar pelo Fallback
                       sozinho, e o handler nativo nunca chega aqui. Testado —
                       com `onError` a imagem sumia certo, mas o texto ao lado
                       continuava dizendo "É assim que seu negócio aparece",
                       que é justamente o tipo de legenda mentirosa que esta
                       missão veio remover. */
                    onLoadingStatusChange={(status) =>
                      setLogoQuebrado(status === "error")
                    }
                  />
                )}
                <AvatarFallback className="rounded-xl bg-primary/10 text-base font-semibold text-primary">
                  {iniciaisDe(businessName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-xs">
                <p className="truncate font-medium text-foreground">
                  {businessName.trim() || "Seu negócio"}
                </p>
                <p className="text-muted-foreground">
                  {!logoInformado
                    ? "Sem logo, usamos as iniciais do nome."
                    : logoQuebrado
                      ? "Não conseguimos carregar essa imagem — confira o endereço."
                      : "É assim que seu negócio aparece na rede."}
                </p>
              </div>
              {/* Remover — botão de ÍCONE de 44px, não um link de texto.
                  Como texto inline ele media 16px de altura: confortável no
                  mouse, quase impossível no polegar, e é neste funil que o
                  parceiro está no celular. O rótulo vai no `aria-label`
                  porque o X sozinho não se explica para leitor de tela. */}
              {logoInformado && (
                <button
                  type="button"
                  aria-label="Remover logo"
                  onClick={() => {
                    setLogoUrl("")
                    setLogoQuebrado(false)
                    limparErro("logoUrl")
                  }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          )}

          <FormField
            name="description"
            label="Descrição do negócio"
            error={erros.description}
            description="Aparece no seu perfil público."
          >
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  limparErro("description")
                }}
              />
            )}
          </FormField>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setStep(0)}
              className={`${ALVO_TOQUE} gap-1`}
            >
              <ChevronLeft className="size-4" aria-hidden /> Voltar
            </Button>
            <Button
              type="submit"
              size="lg"
              pending={isPending}
              pendingText="Salvando…"
              className={`flex-1 ${ALVO_TOQUE}`}
            >
              Continuar
            </Button>
          </div>
        </form>
      )}

      {/* ── Etapa 3 — Confiança ────────────────────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={handleSubmitTrust} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="years-in-business">Anos de atividade</Label>
            <Input
              id="years-in-business"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              placeholder="Ex: 5"
              value={yearsInBusiness}
              onChange={(e) => setYearsInBusiness(e.target.value)}
              className={ALVO_TOQUE}
            />
          </div>

          <label className={`flex ${ALVO_TOQUE} cursor-pointer items-center gap-2.5 text-sm`}>
            <input
              type="checkbox"
              checked={hasCnpj}
              onChange={(e) => setHasCnpj(e.target.checked)}
              className="size-4 shrink-0 rounded accent-primary"
            />
            Possui CNPJ
          </label>

          {verificacaoSolicitada ? (
            /* Estado informativo — não é um controle. Ver o comentário de
               `verificacaoSolicitada`: a solicitação real já existe e o servidor
               não tem como desfazê-la, então um checkbox aqui seria desenhar um
               controle que não faz nada. Ícone + texto: o estado não depende de
               cor para ser lido. */
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden
              />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Verificação solicitada
                </p>
                <p className="text-amber-800/90 dark:text-amber-300/80">
                  Em análise pela equipe Peteen. Avisamos assim que tivermos retorno.
                </p>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <input
                type="checkbox"
                checked={requestVerification}
                onChange={(e) => setRequestVerification(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded accent-primary"
              />
              <span>
                <strong className="font-semibold">Solicitar verificação Peteen</strong>
                <br />
                <span className="text-muted-foreground">
                  Nossa equipe confere seus dados e o selo de verificado aparece no seu
                  perfil. Leva alguns dias.
                </span>
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setStep(1)}
              className={`${ALVO_TOQUE} gap-1`}
            >
              <ChevronLeft className="size-4" aria-hidden /> Voltar
            </Button>
            <Button
              type="submit"
              size="lg"
              pending={isPending}
              pendingText="Salvando…"
              className={`flex-1 ${ALVO_TOQUE}`}
            >
              Continuar
            </Button>
          </div>
        </form>
      )}

      {/* ── Etapa 4 — Recomendações ────────────────────────────────────────── */}
      {step === 3 && (
        <form onSubmit={handleSubmitRecommendations} className="space-y-4">
          {/* Três estados, não dois. "A busca falhou" deixou de ser dito com as
              mesmas palavras de "a cidade não tem ninguém": o repository devolvia
              `[]` no catch, e a tela afirmava que a cidade estava vazia quando na
              verdade ninguém tinha conseguido olhar. */}
          {loadingPros ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Carregando profissionais em {city}…
            </p>
          ) : erroBusca ? (
            <div
              role="alert"
              className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center"
            >
              <AlertCircle className="mx-auto size-5 text-destructive" aria-hidden />
              <p className="text-sm text-foreground">{erroBusca}</p>
              <p className="text-xs text-muted-foreground">
                Isso não diz nada sobre a sua cidade — a busca não chegou a rodar.
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void buscarProfissionais()}
                className={`${ALVO_TOQUE} w-full`}
              >
                Tentar de novo
              </Button>
            </div>
          ) : professionals.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Ainda não encontramos profissionais em {city}. Você pode concluir agora e
              adicionar recomendações depois, pelo seu portal.
            </p>
          ) : (
            <div
              role="group"
              aria-label={`Profissionais em ${city}`}
              className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-2"
            >
              {professionals.map((pro) => (
                <label
                  key={pro.id}
                  className={`flex ${ALVO_TOQUE} cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors ${
                    selectedProIds.includes(pro.id) ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedProIds.includes(pro.id)}
                    onChange={() => toggleProfessional(pro.id)}
                    className="size-4 shrink-0 rounded accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pro.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {pro.city} · Confiança {pro.trustScore.toFixed(0)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setStep(2)}
              className={`${ALVO_TOQUE} gap-1`}
            >
              <ChevronLeft className="size-4" aria-hidden /> Voltar
            </Button>
            <Button
              type="submit"
              size="lg"
              pending={isPending}
              pendingText="Ativando…"
              className={`flex-1 ${ALVO_TOQUE}`}
            >
              {selectedProIds.length > 0
                ? "Concluir e entrar na rede"
                : "Entrar na rede sem recomendações"}
            </Button>
          </div>
        </form>
      )}

      {/* ── Etapa 5 — Sucesso ──────────────────────────────────────────────── */}
      {step === 4 && result && (
        <div className="space-y-6">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" aria-hidden />
            </div>
            <h1 className="font-heading text-2xl font-bold">
              Você agora faz parte da rede Peteen!
            </h1>
            <p className="text-sm text-muted-foreground">
              {result.partner.businessName} está ativo e pronto para recomendar
              profissionais confiáveis.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
            <MetricRow label="Profissionais recomendados" value={result.recommendationCount} />
            <MetricRow label="Conexões de confiança criadas" value={result.connectionsCreated} />

            {/* Ativação — o número sozinho não diz o que fazer com ele. Antes
                saía "80% (80%)", porque `activationScoreLabel` devolvia
                porcentagem; agora o rótulo é qualitativo e a barra dá a leitura
                imediata que o texto não dá. */}
            <div className="space-y-1.5 border-t border-border/70 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nível de ativação</span>
                <span className="font-semibold text-foreground">
                  <span className="tabular-nums">{result.activationScore}%</span>
                  {" · "}
                  {activationScoreLabel(result.activationScore)}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={result.activationScore}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Nível de ativação do perfil"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${result.activationScore}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Quanto mais completo o perfil, mais visibilidade ele ganha no Discovery.
              </p>
            </div>

            {verificacaoSolicitada && (
              <p className="flex items-center gap-2 border-t border-border/70 pt-3 text-xs text-amber-700 dark:text-amber-400">
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
                Verificação solicitada — em análise pela equipe Peteen.
              </p>
            )}
          </div>

          {/* Próximos passos — só o que AINDA falta. Mandar "complete seu logo"
              para quem acabou de mandar o logo faz a lista parecer genérica, e
              a próxima o parceiro não lê. */}
          <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
            <p className="font-medium">Próximos passos</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>Compartilhe seu perfil público com seus clientes</li>
              {result.recommendationCount === 0 && (
                <li>Recomende profissionais que você confia</li>
              )}
              {!result.partner.logoUrl && <li>Adicione o logo do seu negócio</li>}
              {!result.partner.description && <li>Escreva uma descrição do negócio</li>}
              {!verificacaoSolicitada && (
                <li>Solicite a verificação Peteen para ganhar o selo</li>
              )}
            </ul>
          </div>

          <Link
            href={`/partners/${result.partner.slug}`}
            className={`inline-flex w-full ${ALVO_TOQUE} items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90`}
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
