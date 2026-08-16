"use client"

/**
 * CareUpdateForm — publicação de uma atualização de cuidado (só profissional).
 *
 * occurredAt usa <input type="datetime-local"> (horário local do profissional);
 * convertido para ISO UTC antes de enviar à Server Action. Após sucesso,
 * router.refresh() re-renderiza o Server Component e a nova atualização aparece
 * na CareTimeline abaixo.
 */

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { publishCareUpdateAction } from "../application/actions"
import {
  CARE_UPDATE_CATEGORIES,
  CARE_CATEGORY_LABELS,
  CARE_UPDATE_CONTENT_MIN,
  CARE_UPDATE_CONTENT_MAX,
  type CareUpdateCategory,
} from "../domain/types"
import { CarePhotoPicker, type PhotoUiItem } from "./CarePhotoPicker"
import {
  PHOTO_COPY,
  careUpdateDraftKey,
  evaluatePublishReadiness,
  parseCareUpdateDraft,
  serializeCareUpdateDraft,
} from "../domain/photo-selection"

/** Date → "YYYY-MM-DDTHH:mm" no fuso local (formato do input datetime-local). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CareUpdateForm({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [category, setCategory] = useState<CareUpdateCategory>("CHECK_IN")
  const [content, setContent] = useState("")
  const [occurredAtLocal, setOccurredAtLocal] = useState(() => toLocalInputValue(new Date()))
  const [formError, setFormError] = useState<string | null>(null)
  const [fotos, setFotos] = useState<PhotoUiItem[]>([])
  /** Aviso de rascunho recuperado — some assim que a pessoa começa a editar. */
  const [avisoRascunho, setAvisoRascunho] = useState<string | null>(null)
  // Guard síncrono contra duplo-submit (duplo clique / Enter+clique): `isPending`
  // só chega ao `disabled` após um re-render, deixando uma janela de corrida.
  //
  // Este lock protege UMA instância desta tela — nada mais. Duas abas, um
  // reload no meio do envio ou um retry de rede passam por ele sem esbarrar.
  // Quem realmente impede a atualização duplicada é a idempotencyKey abaixo,
  // arbitrada por um unique no banco.
  const submitLockRef = useRef(false)

  /**
   * Identidade da INTENÇÃO de publicar.
   *
   * Ciclo de vida deliberado:
   *   - criada na primeira tentativa desta atualização;
   *   - PRESERVADA em caso de erro — reenviar é a MESMA intenção, e o servidor
   *     precisa reconhecê-la como tal em vez de criar uma segunda linha;
   *   - RENOVADA só após sucesso, porque aí a próxima publicação é outra
   *     intenção.
   */
  const idempotencyKeyRef = useRef<string | null>(null)
  function obterChaveDeIntencao(): string {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }
    return idempotencyKeyRef.current
  }

  // ── Rascunho: recuperar ao montar ─────────────────────────────────────────
  // Só texto e categoria. As fotos são File em memória e morrem com a página
  // (ver domain/photo-selection.ts) — por isso, quando há rascunho, avisamos
  // explicitamente que elas precisam ser reselecionadas em vez de deixar a
  // pessoa achar que publicou com as fotos de antes.
  useEffect(() => {
    try {
      const draft = parseCareUpdateDraft(
        window.sessionStorage.getItem(careUpdateDraftKey(requestId))
      )
      if (!draft) return
      setContent(draft.content)
      if ((CARE_UPDATE_CATEGORIES as readonly string[]).includes(draft.category)) {
        setCategory(draft.category as CareUpdateCategory)
      }
      setAvisoRascunho(PHOTO_COPY.rascunhoRecuperado)
    } catch {
      // sessionStorage indisponível (modo privado, cota, iframe bloqueado):
      // o rascunho é conveniência, nunca requisito para publicar.
    }
  }, [requestId])

  // ── Rascunho: salvar enquanto escreve ─────────────────────────────────────
  useEffect(() => {
    try {
      const chave = careUpdateDraftKey(requestId)
      if (content.trim().length === 0) {
        window.sessionStorage.removeItem(chave)
        return
      }
      window.sessionStorage.setItem(chave, serializeCareUpdateDraft({ content, category }))
    } catch {
      // idem: falha de storage não pode impedir a digitação.
    }
  }, [content, category, requestId])

  function limparRascunho() {
    try {
      window.sessionStorage.removeItem(careUpdateDraftKey(requestId))
    } catch {
      /* nada a fazer */
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (submitLockRef.current) return

    const trimmed = content.trim()
    if (trimmed.length < CARE_UPDATE_CONTENT_MIN) {
      setFormError(`Escreva pelo menos ${CARE_UPDATE_CONTENT_MIN} caracteres.`)
      return
    }

    // ── Erro parcial (item 5 da missão) ─────────────────────────────────────
    // NUNCA publicar só as fotos que deram certo como se estivesse tudo bem: a
    // pessoa selecionou 3 porque queria 3. Ela decide — tentar de novo ou
    // remover — e só então publica conscientemente.
    const prontidao = evaluatePublishReadiness(fotos)
    if (prontidao.kind === "bloqueado_por_erro") {
      setFormError(
        prontidao.comErro === 1
          ? "Uma foto não foi enviada. Tente novamente ou remova a foto para publicar."
          : `${prontidao.comErro} fotos não foram enviadas. Tente novamente ou remova as fotos para publicar.`
      )
      return
    }
    if (prontidao.kind === "aguardando_upload") {
      setFormError("Aguarde o envio das fotos terminar.")
      return
    }

    // datetime-local é horário local — converte para o instante UTC correto.
    const occurredAtIso = new Date(occurredAtLocal).toISOString()
    setFormError(null)
    submitLockRef.current = true

    startTransition(async () => {
      try {
        const result = await publishCareUpdateAction({
          requestId,
          category,
          content: trimmed,
          occurredAt: occurredAtIso,
          mediaPaths: prontidao.paths,
          idempotencyKey: obterChaveDeIntencao(),
        })

        if (!result.success) {
          // Chave preservada de propósito: a próxima tentativa é a mesma
          // intenção, e o servidor precisa poder reconhecê-la.
          //
          // Se as fotos JÁ subiram, a pessoa precisa saber que o problema foi a
          // publicação — não o envio — para não reenviar tudo achando que
          // perdeu os arquivos.
          setFormError(
            prontidao.paths.length > 0 ? PHOTO_COPY.publicacaoFalhou : result.error
          )
          return
        }

        toast.success("Atualização publicada.")
        // Publicou: a próxima atualização é outra intenção.
        idempotencyKeyRef.current = null
        setContent("")
        setOccurredAtLocal(toLocalInputValue(new Date()))
        // As objectURLs morrem junto com os itens; o picker revoga no unmount
        // de cada preview removido e no seu próprio unmount.
        for (const f of fotos) URL.revokeObjectURL(f.previewUrl)
        setFotos([])
        setAvisoRascunho(null)
        limparRascunho()
        router.refresh()
      } finally {
        submitLockRef.current = false
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="care-category">Categoria</Label>
        <select
          id="care-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as CareUpdateCategory)}
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {CARE_UPDATE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CARE_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="care-content">O que aconteceu?</Label>
        <Textarea
          id="care-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (formError) setFormError(null)
            if (avisoRascunho) setAvisoRascunho(null)
          }}
          rows={3}
          maxLength={CARE_UPDATE_CONTENT_MAX}
          placeholder="Ex: Rex almoçou bem e ficou tranquilo depois do passeio."
          disabled={isPending}
        />
        <span className="self-end text-xs text-muted-foreground">
          {content.trim().length}/{CARE_UPDATE_CONTENT_MAX}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="care-occurred-at">Quando</Label>
        <input
          id="care-occurred-at"
          type="datetime-local"
          value={occurredAtLocal}
          onChange={(e) => setOccurredAtLocal(e.target.value)}
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <CarePhotoPicker
        requestId={requestId}
        itens={fotos}
        onChange={setFotos}
        disabled={isPending}
      />

      {avisoRascunho ? (
        <p
          role="status"
          className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          {avisoRascunho}
        </p>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      {/* min-h-11 = 44px: alvo de toque mínimo. O tamanho padrão do Button dá
          32px, o que o QA em 390px flagrou como abaixo do mínimo — e esta é a
          ação principal da tela, usada com o polegar durante um atendimento. */}
      <Button type="submit" className="min-h-11 w-full gap-2" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Publicando...
          </>
        ) : (
          <>
            <Send className="size-4" />
            Publicar atualização
          </>
        )}
      </Button>
    </form>
  )
}
