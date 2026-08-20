"use client"

/**
 * CareMediaGallery — as fotos de UMA atualização, com ampliação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONSOME APENAS O DTO SEGURO
 *
 * Recebe `CareMediaView[]`, que tem `signedUrl` e nunca `storagePath` (ver
 * toCareUpdateDTO). Este componente não sabe o que é um bucket, não monta URL
 * e não tem como apontar para um objeto arbitrário — se um dia alguém tentar
 * passar um path daqui, o tipo não compila.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * URL ASSINADA EXPIRA — E ISSO NÃO PODE QUEBRAR O DIÁRIO (item 10)
 *
 * A URL vive ~1 h. Uma aba aberta desde a manhã vai encontrar 403 ao rolar até
 * uma foto antiga. O tratamento é deliberadamente discreto: a miniatura vira um
 * placeholder neutro ("Foto indisponível") e o RELATO DE TEXTO continua
 * intacto ao lado — que é o núcleo da feature. Nada de erro técnico, nada de
 * derrubar a lista. O próximo render/refetch traz uma URL nova.
 *
 * Não há retry automático de imagem aqui: re-emitir URL exige ida ao servidor,
 * e um loop de retry por imagem quebrada numa timeline longa geraria uma
 * rajada de requisições justamente quando o Storage está instável.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE <img> E NÃO next/image
 *
 * `next/image` otimiza via proxy do servidor a partir de um host configurado.
 * Estas URLs são assinadas, de vida curta e por objeto — passá-las pelo
 * otimizador exigiria liberar o host do Storage em `remotePatterns` e produziria
 * cache de conteúdo privado na borda. Para mídia privada e efêmera, a tag
 * nativa é a escolha correta, não um atalho.
 *
 * A otimização que o `next/image` daria vem, aqui, do próprio Storage: a grade
 * pede uma MINIATURA (288px) e o lightbox uma versão de VISUALIZAÇÃO (1600px),
 * ambas redimensionadas na leitura — mesma URL assinada, mesmo objeto, mesma
 * autorização. A ORIGINAL fica preservada no bucket e não é servida por padrão
 * em superfície nenhuma. Ver lib/storage/care-media-transform.ts.
 */

import { useRef, useState } from "react"
import { ImageOff, RotateCcw } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CareMediaView } from "../domain/types"
import { imagemChegouQuebrada } from "../domain/media-display"
import {
  CARE_MEDIA_THUMBNAIL_PX,
  resolveLightboxImageSrc,
  resolveTimelineImageSrc,
} from "@/lib/storage/care-media-transform"

/**
 * Alt text descritivo o suficiente para leitor de tela sem descrever o que não
 * conhecemos. Não temos legenda por foto no V0; o contexto útil é a categoria
 * e o relato, que estão adjacentes na mesma entrada da timeline.
 */
function altDaFoto(indice: number, total: number): string {
  return total === 1
    ? "Foto da atualização de cuidado"
    : `Foto ${indice + 1} de ${total} da atualização de cuidado`
}

export function CareMediaGallery({
  media,
  prioridade = false,
}: {
  media: CareMediaView[]
  /**
   * Esta galeria está no topo da timeline?
   *
   * `loading="lazy"` em TODAS as fotos atrasa também a primeira — que é a
   * única garantidamente visível ao abrir o Diário, e a mais relevante agora
   * que a ordem é recent-first. Só a primeira foto da primeira atualização
   * carrega com prioridade; o resto continua lazy.
   */
  prioridade?: boolean
}) {
  const [ampliada, setAmpliada] = useState<CareMediaView | null>(null)
  const [quebradas, setQuebradas] = useState<Set<string>>(new Set())
  /** Fases do lightbox — ver o bloco de estados mais abaixo. */
  const [estadoAmpliada, setEstadoAmpliada] = useState<"carregando" | "pronta" | "erro">(
    "carregando"
  )
  /** Força um `src` novo no retry: sem isto o browser reusaria a falha em cache. */
  const [tentativa, setTentativa] = useState(0)

  /**
   * Pré-carrega a versão de visualização quando há SINAL DE INTENÇÃO — o
   * ponteiro parou sobre a miniatura, ou o dedo encostou nela. Assim, no
   * instante do clique, a imagem do lightbox já costuma estar no cache do
   * navegador.
   *
   * Deliberadamente NÃO pré-carrega tudo: são até 3 fotos por atualização e
   * várias atualizações na tela; baixar todas as versões de 1600px por
   * antecipação desfaria a economia que esta missão inteira busca. Só a que a
   * pessoa demonstrou interesse em abrir.
   *
   * `new Image()` e não `<link rel=preload>`: não precisa entrar no documento,
   * o browser dedupe pela mesma URL, e nada é inserido no DOM.
   */
  function prepararAmpliacao(m: CareMediaView) {
    if (typeof window === "undefined") return
    const img = new window.Image()
    img.src = resolveLightboxImageSrc(m)
  }

  function abrirAmpliada(m: CareMediaView) {
    setEstadoAmpliada("carregando")
    setTentativa(0)
    setAmpliada(m)
  }

  /**
   * Botão que abriu o lightbox, para devolver o foco ao fechar.
   *
   * Necessário porque não usamos `DialogTrigger`: cada miniatura é um botão
   * próprio e o Dialog é controlado por estado. Sem isto, o QA ao vivo mostrou
   * o foco caindo em `<body>` após Escape — um usuário de teclado perderia o
   * lugar na grade e teria de tabular desde o topo da página.
   */
  const gatilhoRef = useRef<HTMLButtonElement | null>(null)

  if (media.length === 0) return null

  function marcarQuebrada(id: string) {
    setQuebradas((atual) => {
      // Devolver o MESMO Set quando o id já está lá evita um re-render inútil.
      // Importa porque `marcarQuebrada` agora também é chamada do callback de
      // ref, que roda a cada commit: criar um Set novo toda vez faria o React
      // re-renderizar em looping.
      if (atual.has(id)) return atual
      const proximo = new Set(atual)
      proximo.add(id)
      return proximo
    })
  }

  const indiceAmpliada = ampliada ? media.findIndex((m) => m.id === ampliada.id) : -1

  return (
    <>
      {/* 3 colunas fixas: o teto por atualização é 3 (CARE_MEDIA_MAX_PER_UPDATE),
          então a grade nunca quebra linha e cada miniatura mantém proporção
          quadrada mesmo em 320px. */}
      <ul className="mt-2 grid grid-cols-3 gap-1.5">
        {media.map((m, indice) => {
          const estaQuebrada = quebradas.has(m.id)
          return (
            <li key={m.id}>
              {estaQuebrada ? (
                <div
                  className="grid aspect-square place-items-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground"
                  role="img"
                  aria-label="Foto indisponível no momento"
                >
                  <ImageOff className="size-4" aria-hidden />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    gatilhoRef.current = e.currentTarget
                    abrirAmpliada(m)
                  }}
                  // Sinais de INTENÇÃO — ver prepararAmpliacao. `onPointerEnter`
                  // cobre mouse; `onTouchStart` dispara no toque, antes do
                  // clique, dando alguns milissegundos de vantagem no celular.
                  onPointerEnter={() => prepararAmpliacao(m)}
                  onTouchStart={() => prepararAmpliacao(m)}
                  aria-label={`Ampliar ${altDaFoto(indice, media.length).toLowerCase()}`}
                  className="block aspect-square w-full overflow-hidden rounded-lg border border-border/70 bg-muted/30 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    /* MINIATURA (288px), não a original: a grade desenha um
                       quadrado de ~96 CSS px. Medido nas fotos reais do QA,
                       isso troca 4,7 MB por 11 KB por foto. Cai para a
                       original quando a miniatura não pôde ser assinada. */
                    src={resolveTimelineImageSrc(m)}
                    /* Dimensões intrínsecas = as da miniatura. Com o
                       `aspect-square` do container o layout já não pulava;
                       declará-las evita que o navegador reserve caixa a partir
                       da resolução da original em qualquer contexto futuro. */
                    width={CARE_MEDIA_THUMBNAIL_PX}
                    height={CARE_MEDIA_THUMBNAIL_PX}
                    alt={altDaFoto(indice, media.length)}
                    // Só a primeira foto do topo é ansiosa; o resto espera a
                    // viewport. Lazy em tudo atrasaria a única imagem que a
                    // pessoa com certeza vai ver.
                    loading={prioridade && indice === 0 ? "eager" : "lazy"}
                    fetchPriority={prioridade && indice === 0 ? "high" : "auto"}
                    decoding="async"
                    /* Fecha a janela pré-hidratação: uma imagem que veio do
                       SSR e falhou antes de o React anexar `onError` já está
                       `complete` com `naturalWidth === 0` quando este callback
                       roda. Só inspeção do elemento — sem rede, sem retry. */
                    ref={(node) => {
                      if (node && imagemChegouQuebrada(node)) marcarQuebrada(m.id)
                    }}
                    onError={() => marcarQuebrada(m.id)}
                    className="size-full object-cover"
                  />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {/* Base UI Dialog: foco preso, Escape fecha, retorno de foco ao gatilho —
          sem dependência nova nem focus trap escrito à mão. */}
      <Dialog open={ampliada !== null} onOpenChange={(aberto) => !aberto && setAmpliada(null)}>
        {/* finalFocus vive no Popup (não no Root) nesta versão do Base UI. */}
        <DialogContent
          finalFocus={gatilhoRef}
          className="max-w-[calc(100%-1.5rem)] p-2 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Foto da atualização de cuidado</DialogTitle>
          <DialogDescription className="sr-only">
            Toque fora da imagem ou pressione Escape para fechar.
          </DialogDescription>
          {ampliada ? (
            /* Altura mínima reservada ANTES de a imagem chegar: sem isto o
               diálogo nasce colapsado e cresce de repente quando a foto
               decodifica — o layout shift que o item 10 pede para evitar.
               `min-h` e não `aspect-ratio` fixo porque a proporção real varia
               (retrato, paisagem, quadrado) e forçar uma delas distorceria ou
               recortaria a evidência. */
            <div className="relative grid min-h-[45vh] w-full place-items-center">
              {estadoAmpliada === "carregando" ? (
                <div
                  className="absolute inset-0 animate-pulse rounded-lg bg-muted/50"
                  role="status"
                  aria-label="Carregando foto"
                />
              ) : null}

              {estadoAmpliada === "erro" ? (
                /* Falha no lightbox NÃO fecha o diálogo nem marca a miniatura
                   como quebrada: a foto da grade continuou funcionando, e
                   fechar sozinho tira da pessoa a chance de tentar de novo. */
                <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                  <ImageOff className="size-6 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar esta foto.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEstadoAmpliada("carregando")
                      setTentativa((t) => t + 1)
                    }}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
                  >
                    <RotateCcw className="size-4" />
                    Tentar novamente
                  </button>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  /* Versão de VISUALIZAÇÃO (1600px), não a original: 286 KB
                     contra 4,7 MB medidos, com resolução de sobra para o
                     diálogo e para pinch-zoom. A original fica preservada no
                     bucket, mas não é mais servida por padrão em superfície
                     nenhuma. Cai para ela se a variante faltar. */
                  src={resolveLightboxImageSrc(ampliada)}
                  /* `key` com a tentativa força o browser a refazer a
                     requisição no retry — sem isto ele reusaria a falha. */
                  key={`${ampliada.id}-${tentativa}`}
                  alt={altDaFoto(indiceAmpliada, media.length)}
                  decoding="async"
                  onLoad={() => setEstadoAmpliada("pronta")}
                  onError={() => setEstadoAmpliada("erro")}
                  className={`max-h-[75vh] w-full rounded-lg object-contain transition-opacity duration-200 ${
                    estadoAmpliada === "pronta" ? "opacity-100" : "opacity-0"
                  }`}
                />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
