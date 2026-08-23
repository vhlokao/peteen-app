"use client"

/**
 * CarePhotoPicker — seleção, preview e envio das fotos de UMA atualização.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEPARADO DO FORMULÁRIO DE PROPÓSITO
 *
 * O CareUpdateForm cuida de texto/categoria/quando e do submit. Aqui vive todo
 * o ciclo de vida da mídia — que tem estado próprio por item, I/O de rede e
 * objectURLs a revogar. Misturar os dois faria um componente com duas máquinas
 * de estado independentes e um `useEffect` de limpeza que ninguém consegue ler.
 *
 * As DECISÕES (o que aceitar, quantas cabem, pode publicar?) não estão aqui:
 * estão em domain/photo-selection.ts, puras e testadas. Este arquivo é fiação
 * — DOM, objectURL, chamada de rede.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO POR FOTO, NÃO DO FORMULÁRIO (item 6 da missão)
 *
 * Uma foto falhando não pode travar a leitura nem a edição do texto. Cada item
 * carrega o próprio `status`, e só o botão de publicar reage ao conjunto — via
 * `evaluatePublishReadiness`, no componente pai.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  AlertCircle,
  Camera,
  FileVideo,
  ImagePlus,
  Loader2,
  RotateCcw,
  Video,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { requestCareMediaUploadTicketAction } from "../application/actions"
import { uploadCareMediaToTicket } from "../infrastructure/upload-care-media-client"
import {
  CARE_MEDIA_MAX_PER_UPDATE,
  CARE_VIDEO_MAX_DURATION_SECONDS,
  PHOTO_COPY,
  VIDEO_COPY,
  canAddMorePhotos,
  copyDeFalhaUpload,
  photoCounterLabel,
  remainingPhotoSlots,
  validatePhotoCandidate,
  validateVideoCandidate,
  type PhotoSelectionItem,
} from "../domain/photo-selection"
import { MEDIA_QUERY_CAPTURA, deveOferecerCameraPrimeiro } from "../domain/camera-capture"

/**
 * O item da UI carrega, além do estado de domínio, as duas coisas que só
 * existem no browser: o File original (para retry) e a objectURL do preview.
 */
export type PhotoUiItem = PhotoSelectionItem & {
  file: File
  previewUrl: string
  /** Decide o preview (img vs video) e a cota aplicável. */
  kind: "PHOTO" | "VIDEO"
}

/**
 * Lê a duração real do vídeo, do próprio arquivo, antes de qualquer upload.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE É O ÚNICO LUGAR DO SISTEMA QUE CONHECE A DURAÇÃO
 *
 * O servidor não valida os 60s — provar isso exigiria parsear a caixa `mvhd`
 * do container, e um arquivo forjado pode mentir nela (ver o comentário do
 * enum em schema.prisma). Então esta função não é uma conveniência de UX: é a
 * ÚNICA aplicação da regra. Se ela falhar, `validateVideoCandidate` recusa —
 * publicar sem saber a duração seria fingir que o limite existe.
 *
 * `preload="metadata"` no elemento temporário: precisamos só do cabeçalho, não
 * do arquivo. Um vídeo de 50 MB não é baixado para descobrir que tem 90s.
 *
 * O timeout existe porque `loadedmetadata` pode simplesmente nunca disparar
 * (arquivo corrompido, codec que o browser não abre) e a promessa ficaria
 * pendurada, deixando o botão de publicar travado sem explicação.
 */
function lerDuracaoDoVideo(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement("video")
    el.preload = "metadata"

    let resolvido = false
    const terminar = (valor: number | null) => {
      if (resolvido) return
      resolvido = true
      clearTimeout(timer)
      // Revoga sempre: a objectURL deste elemento temporário não é a mesma do
      // preview, e vazá-la aqui somaria um blob por vídeo selecionado.
      URL.revokeObjectURL(url)
      el.removeAttribute("src")
      resolve(valor)
    }

    const timer = setTimeout(() => terminar(null), 10_000)

    el.onloadedmetadata = () => {
      const d = el.duration
      terminar(Number.isFinite(d) && d > 0 ? d : null)
    }
    el.onerror = () => terminar(null)

    el.src = url
  })
}

type Props = {
  requestId: string
  itens: PhotoUiItem[]
  onChange: (itens: PhotoUiItem[]) => void
  /** Some durante a publicação — evita mexer na seleção com envio em curso. */
  disabled: boolean
}

/**
 * MIME/aceite do input — a MESMA lista para câmera e galeria. `validatePhotoCandidate`
 * (domain) é quem decide de verdade; isto é só o filtro nativo do picker.
 */
const ACCEPT_IMAGENS = "image/jpeg,image/png,image/webp"

/**
 * Aceite do input de vídeo.
 *
 * Lista explícita em vez de `video/*`: o genérico deixaria o seletor oferecer
 * WebM, 3GP e MKV, que o `validateVideoCandidate` recusaria logo depois — pior
 * experiência que não oferecer. Alguns navegadores mobile ignoram a lista e
 * mostram tudo mesmo assim; por isso a validação continua sendo a autoridade.
 */
const ACCEPT_VIDEOS = "video/mp4,video/quicktime"

export function CarePhotoPicker({ requestId, itens, onChange, disabled }: Props) {
  const inputId = useId()
  const cameraInputId = useId()
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const videoCameraInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const [erroSelecao, setErroSelecao] = useState<string | null>(null)

  /**
   * Câmera-primeiro em qualquer aparelho com toque disponível — ver a
   * justificativa completa (e o incidente do Android que não mostrava o botão)
   * em domain/camera-capture.ts.
   *
   * `false` NO PRIMEIRO RENDER, SEMPRE — SSR não tem `window`, e arrancar já
   * assumindo mobile arriscaria um flash de layout trocando de dois botões
   * para um assim que o client montasse. Começar "desktop" e promover depois
   * do mount é a única ordem sem esse salto: o caso comum (abrir o Diário já
   * num celular) resolve em um re-render, imperceptível.
   */
  const [preferirCamera, setPreferirCamera] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const avaliar = () => {
      // `matchMedia` ausente (navegador muito antigo) não pode zerar o outro
      // sinal: `maxTouchPoints` sozinho ainda decide.
      const algumApontadorImpreciso = window.matchMedia
        ? window.matchMedia(MEDIA_QUERY_CAPTURA).matches
        : false
      setPreferirCamera(
        deveOferecerCameraPrimeiro({
          algumApontadorImpreciso,
          pontosDeToque: navigator.maxTouchPoints ?? 0,
        })
      )
    }

    avaliar()

    if (!window.matchMedia) return
    // Reavalia quando o conjunto de apontadores muda — acoplar/desacoplar
    // teclado num tablet, parear um mouse, entrar em modo desktop.
    const mql = window.matchMedia(MEDIA_QUERY_CAPTURA)
    mql.addEventListener("change", avaliar)
    return () => mql.removeEventListener("change", avaliar)
  }, [])

  // `itens` numa ref para o cleanup de unmount não precisar de `itens` na
  // dependência (o que revogaria as URLs a cada mudança da lista, quebrando
  // previews vivos).
  const itensRef = useRef(itens)
  itensRef.current = itens

  /**
   * ÚNICO caminho de mutação da lista — e a ref é atualizada ANTES do
   * `onChange`, no mesmo tick.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * O BUG QUE ISTO CORRIGE (incidente físico: foto nunca publicava)
   *
   * `itensRef.current` só era reatribuído durante o RENDER. Mas `handleFiles`
   * chamava `onChange([...itens, ...novos])` e, no MESMO tick, iniciava
   * `enviarFoto`, cujo primeiro `marcar()` roda de forma síncrona (antes do
   * primeiro await) e montava a nova lista a partir da ref AINDA ANTIGA — sem
   * as fotos recém-selecionadas. Como React agrupa os dois `setState` do mesmo
   * evento e o último vence, a seleção era descartada imediatamente.
   *
   * O upload continuava (o `File` vive no closure, não no estado), então o
   * objeto chegava ao bucket — mas o `path` era gravado numa lista que já não
   * continha o item, `evaluatePublishReadiness` devolvia `paths: []`, e a
   * atualização publicava SEM mídia. Isso explica, exatamente, o banco ter
   * objetos órfãos no Storage e ZERO linhas em `CareMedia` desde sempre.
   *
   * Manter a ref sincronizada aqui — em vez de trocar `onChange` por updater
   * funcional — preserva o contrato do componente com o pai e mantém a
   * correção contida num só ponto.
   */
  const aplicar = useCallback(
    (proximos: PhotoUiItem[]) => {
      itensRef.current = proximos
      onChange(proximos)
    },
    [onChange]
  )

  // Revoga objectURLs ao desmontar. Sem isto, cada seleção vaza um blob na
  // memória da aba até o reload — perceptível num atendimento longo com várias
  // publicações seguidas.
  useEffect(() => {
    return () => {
      for (const item of itensRef.current) URL.revokeObjectURL(item.previewUrl)
    }
  }, [])

  /**
   * Envia UMA foto: pede o ticket ao servidor e entrega os bytes ao bucket.
   * Atualiza o item pelo id (não pelo índice) porque a lista pode ter mudado
   * enquanto o upload estava em voo — remover outra foto durante o envio é
   * legítimo e não pode corromper o item errado.
   */
  const enviarFoto = useCallback(
    async (itemId: string, file: File, kind: "PHOTO" | "VIDEO") => {
      const marcar = (patch: Partial<PhotoUiItem>) => {
        aplicar(itensRef.current.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
      }

      marcar({ status: "enviando", errorMessage: null })

      const ticketResult = await requestCareMediaUploadTicketAction({
        requestId,
        mimeType: file.type,
      })

      if (!ticketResult.ok) {
        // A mensagem vem do servidor já humanizada (care-media-authorization
        // nunca devolve código técnico ao cliente).
        marcar({ status: "erro", errorMessage: ticketResult.message })
        return
      }

      // A copy segue o TIPO do item, não o nome da função: este caminho é
      // compartilhado por foto e vídeo, e no primeiro upload real de vídeo o
      // profissional leu "não foi possível enviar esta foto" depois de gravar
      // um vídeo. A copy de vídeo já existia — só não era escolhida.
      const upload = await uploadCareMediaToTicket({
        file,
        ticket: ticketResult.ticket,
        mimeTypeAutorizado: file.type,
        mensagemDeFalha: copyDeFalhaUpload(kind),
        kind,
      })

      if (!upload.ok) {
        marcar({ status: "erro", errorMessage: upload.message })
        return
      }

      marcar({ status: "enviada", path: upload.path, errorMessage: null })
    },
    [aplicar, requestId]
  )

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setErroSelecao(null)

    const vagas = remainingPhotoSlots(itens.length)
    if (vagas === 0) {
      setErroSelecao(PHOTO_COPY.limiteAtingido)
      return
    }

    const candidatos = Array.from(files).slice(0, vagas)
    // Selecionou mais do que cabe: aceita o que couber e explica o resto, em
    // vez de recusar a seleção inteira em silêncio.
    if (files.length > vagas) {
      setErroSelecao(PHOTO_COPY.limiteAtingido)
    }

    const novos: PhotoUiItem[] = []
    for (const file of candidatos) {
      const validacao = validatePhotoCandidate({ type: file.type, size: file.size })
      if (!validacao.ok) {
        setErroSelecao(validacao.message)
        continue
      }
      novos.push({
        id: crypto.randomUUID(),
        status: "pronta",
        path: null,
        errorMessage: null,
        file,
        previewUrl: URL.createObjectURL(file),
        kind: "PHOTO",
      })
    }

    if (novos.length === 0) return

    aplicar([...itens, ...novos])
    // Upload começa imediatamente: quando a pessoa termina de escrever, as
    // fotos já estão no bucket e publicar é instantâneo.
    for (const novo of novos) void enviarFoto(novo.id, novo.file, "PHOTO")
  }

  /**
   * Fluxo de VÍDEO — separado de `handleFiles` porque a validação é
   * assíncrona (precisa ler a duração do arquivo) e a cota é outra.
   */
  async function handleVideoFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setErroSelecao(null)

    // Exclusividade do contrato V0: uma atualização carrega OU até 3 fotos OU
    // 1 vídeo. Não é limitação técnica — é o desenho da galeria, que renderiza
    // um player de largura cheia para vídeo e uma grade de miniaturas para
    // foto. Misturar exigiria uma terceira superfície sem ganho claro no V0.
    if (temFoto) {
      setErroSelecao(VIDEO_COPY.misturaComFoto)
      return
    }
    if (temVideo) {
      setErroSelecao(VIDEO_COPY.limiteAtingido)
      return
    }

    const file = files[0]!
    // A duração é lida ANTES de aceitar — ver lerDuracaoDoVideo.
    const duracaoSegundos = await lerDuracaoDoVideo(file)

    const validacao = validateVideoCandidate({
      type: file.type,
      size: file.size,
      duracaoSegundos,
    })
    if (!validacao.ok) {
      setErroSelecao(validacao.message)
      return
    }

    const novo: PhotoUiItem = {
      id: crypto.randomUUID(),
      status: "pronta",
      path: null,
      errorMessage: null,
      file,
      previewUrl: URL.createObjectURL(file),
      kind: "VIDEO",
    }

    aplicar([...itens, novo])
    void enviarFoto(novo.id, novo.file, "VIDEO")
  }

  function removerFoto(item: PhotoUiItem) {
    URL.revokeObjectURL(item.previewUrl)
    aplicar(itens.filter((i) => i.id !== item.id))
    setErroSelecao(null)
    // Remover uma foto que falhou pode reabrir vaga — a mensagem de limite
    // deixaria de ser verdade.
  }

  const temVideo = itens.some((i) => i.kind === "VIDEO")
  const temFoto = itens.some((i) => i.kind === "PHOTO")
  // Foto e vídeo se excluem — ver handleVideoFiles.
  const podeAdicionar = canAddMorePhotos(itens.length) && !disabled && !temVideo
  const podeAdicionarVideo = !temVideo && !temFoto && !disabled

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Fotos</span>
        <span
          className="text-xs tabular-nums text-muted-foreground"
          aria-label={`${itens.length} de ${CARE_MEDIA_MAX_PER_UPDATE} fotos selecionadas`}
        >
          {photoCounterLabel(itens.length)}
        </span>
      </div>

      {itens.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {itens.map((item) => (
            <li
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-muted/30"
            >
              {/* Preview local — o arquivo ainda pode nem ter subido.
                  Vídeo usa <video muted preload="metadata">: mostra o primeiro
                  frame sem baixar o arquivo e sem tocar áudio. Sem `controls`
                  aqui de propósito — este é um preview de seleção, não o
                  player; os controles reais vivem na timeline publicada. */}
              {item.kind === "VIDEO" ? (
                <video
                  src={item.previewUrl}
                  preload="metadata"
                  muted
                  playsInline
                  className="size-full bg-black object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt="" className="size-full object-cover" />
              )}

              {/* Véu de estado: só cobre quando há algo a comunicar. */}
              {item.status === "enviando" ? (
                <span className="absolute inset-0 grid place-items-center bg-background/70">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="sr-only">Enviando foto…</span>
                </span>
              ) : null}

              {item.status === "erro" ? (
                <span className="absolute inset-0 grid place-items-center gap-1 bg-destructive/15 p-1">
                  <AlertCircle className="size-5 text-destructive" aria-hidden />
                  <button
                    type="button"
                    onClick={() => void enviarFoto(item.id, item.file, item.kind)}
                    disabled={disabled}
                    aria-label="Tentar enviar esta foto novamente"
                    className="flex min-h-11 items-center gap-1 rounded-lg bg-background/90 px-2 text-xs font-medium text-foreground"
                  >
                    <RotateCcw className="size-3.5" />
                    Tentar
                  </button>
                </span>
              ) : null}

              {/* Alvo de toque de 44px (item 15) com aparência de 28px: numa
                  miniatura de ~96px em 320px, um botão visualmente de 44px
                  cobriria metade do preview. O <span> interno é o que se vê;
                  o <button> é a área tocável. */}
              <button
                type="button"
                onClick={() => removerFoto(item)}
                disabled={disabled}
                aria-label="Remover esta foto"
                className="absolute right-0 top-0 grid size-11 place-items-center disabled:opacity-50"
              >
                <span className="grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm">
                  <X className="size-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Erro por foto, fora da grade: dentro do quadrado de 1/3 de largura a
          frase não caberia legível em 320px. */}
      {itens.some((i) => i.status === "erro") ? (
        <ul className="flex flex-col gap-1">
          {itens
            .filter((i) => i.status === "erro")
            .map((i) => (
              <li key={i.id} className="text-xs text-destructive">
                {/* Fallback também por tipo: um vídeo sem mensagem própria
                    não pode herdar a frase de foto. */}
                {i.errorMessage ?? copyDeFalhaUpload(i.kind)}
              </li>
            ))}
        </ul>
      ) : null}

      {/*
        Dois inputs, um pipeline só: os dois disparam o MESMO handleFiles —
        nenhum protocolo de upload, validação ou mídia muda entre eles. A
        única diferença é o atributo `capture`, que decide se o navegador
        oferece a câmera antes da galeria.

        Câmera sem `multiple`: `capture` já implica UMA foto por captura —
        pedir várias ao mesmo tempo não é como o fluxo de câmera funciona em
        nenhum browser. Quem quer 3 fotos tira 3 vezes ou usa a galeria.
      */}
      <input
        ref={cameraInputRef}
        id={cameraInputId}
        type="file"
        accept={ACCEPT_IMAGENS}
        capture="environment"
        className="sr-only"
        disabled={!podeAdicionar}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT_IMAGENS}
        multiple
        className="sr-only"
        disabled={!podeAdicionar}
        onChange={(e) => {
          handleFiles(e.target.files)
          // Zera para permitir reselecionar o MESMO arquivo depois de removê-lo
          // (sem isto o input não dispara change para um valor idêntico).
          e.target.value = ""
        }}
      />

      {preferirCamera ? (
        <div className="flex flex-col gap-2">
          {/* Ação PRINCIPAL — maior destaque (variant default, preenchido). */}
          <Button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={!podeAdicionar}
            className="min-h-11 w-full gap-2"
          >
            <Camera className="size-4" />
            Tirar foto agora
          </Button>
          {/* Ação secundária — outline, mesmo peso visual do botão único de desktop. */}
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={!podeAdicionar}
            className="min-h-11 w-full gap-2"
          >
            <ImagePlus className="size-4" />
            Escolher da galeria
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={!podeAdicionar}
          className="min-h-11 w-full gap-2"
        >
          <ImagePlus className="size-4" />
          {itens.length === 0 ? "Adicionar foto" : "Adicionar outra foto"}
        </Button>
      )}

      {/* ── VÍDEO ────────────────────────────────────────────────────────────
          Dois inputs pelo mesmo motivo das fotos: `capture` decide se o
          navegador oferece a câmera antes da galeria.

          HONESTIDADE SOBRE `capture` EM VÍDEO: no Android Chrome ele costuma
          abrir a câmera já em modo vídeo; no iOS Safari o comportamento varia
          por versão e frequentemente abre a bandeja (Câmera / Fototeca /
          Arquivos). Por isso os DOIS botões existem sempre que a captura é
          oferecida — nunca prometemos que o primeiro abre a câmera direto. Em
          desktop `capture` é ignorado e ambos abrem o seletor de arquivos.

          Sem `multiple`: o contrato V0 é 1 vídeo por atualização. */}
      <input
        ref={videoCameraInputRef}
        type="file"
        accept={ACCEPT_VIDEOS}
        capture="environment"
        className="sr-only"
        disabled={!podeAdicionarVideo}
        onChange={(e) => {
          void handleVideoFiles(e.target.files)
          e.target.value = ""
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={ACCEPT_VIDEOS}
        className="sr-only"
        disabled={!podeAdicionarVideo}
        onChange={(e) => {
          void handleVideoFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {podeAdicionarVideo ? (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-2">
          <span className="text-xs text-muted-foreground">
            Ou envie um vídeo de até {CARE_VIDEO_MAX_DURATION_SECONDS} segundos
            (sem fotos na mesma atualização).
          </span>
          {preferirCamera ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => videoCameraInputRef.current?.click()}
                className="min-h-11 w-full gap-2"
              >
                <Video className="size-4" />
                Gravar vídeo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => videoInputRef.current?.click()}
                className="min-h-11 w-full gap-2"
              >
                <FileVideo className="size-4" />
                Escolher vídeo
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => videoInputRef.current?.click()}
              className="min-h-11 w-full gap-2"
            >
              <FileVideo className="size-4" />
              Adicionar vídeo
            </Button>
          )}
        </div>
      ) : null}

      {erroSelecao ? (
        <p role="alert" className="text-xs text-destructive">
          {erroSelecao}
        </p>
      ) : null}
    </div>
  )
}
