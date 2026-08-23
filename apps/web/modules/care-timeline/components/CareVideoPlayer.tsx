"use client"

/**
 * CareVideoPlayer — o vídeo de UMA atualização de cuidado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A TIMELINE NÃO PODE BAIXAR VÍDEO SOZINHA
 *
 * `preload="metadata"` é o coração deste componente. Com `auto` (ou sem o
 * atributo, cujo default é decidido pelo browser), abrir o Diário com três
 * atualizações de vídeo começaria a baixar até 150 MB antes de qualquer gesto
 * — no celular do tutor, provavelmente em rede móvel.
 *
 * Com `metadata` o browser busca só o cabeçalho: duração, dimensões e, na
 * maioria dos casos, o primeiro frame — que serve de poster natural. O arquivo
 * só começa a ser baixado quando a pessoa toca em play.
 *
 * Isso é também o motivo de NÃO haver poster gerado: derivar um frame no
 * servidor exigiria ffmpeg/transcodificação, explicitamente fora do V0. O
 * primeiro frame que o `metadata` já traz cobre o caso comum de graça.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEM AUTOPLAY, SEMPRE COM CONTROLES
 *
 * `autoPlay` não existe aqui e não deve passar a existir: um vídeo que começa
 * sozinho numa timeline dispara áudio inesperado — num contexto em que a
 * pessoa pode estar em público — e consome dados sem consentimento. `controls`
 * nativo é deliberado: o player do sistema já resolve tela cheia, velocidade,
 * legenda, Picture-in-Picture e acessibilidade de teclado melhor do que
 * qualquer controle nosso, em todos os aparelhos que o piloto atende.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * URL ASSINADA EXPIRA — MESMO CONTRATO DA FOTO
 *
 * A URL vive ~1 h. Uma aba aberta desde a manhã encontra 403 ao tocar play. O
 * tratamento é o mesmo da galeria de fotos: um bloco neutro dizendo que o vídeo
 * está indisponível, com o RELATO DE TEXTO intacto ao lado. Sem erro técnico,
 * sem derrubar a timeline, sem retry automático (que viraria rajada de
 * requisições justamente quando o Storage está instável).
 */

import { useState } from "react"
import { VideoOff } from "lucide-react"

import type { CareMediaView } from "../domain/types"

export function CareVideoPlayer({ media }: { media: CareMediaView }) {
  const [falhou, setFalhou] = useState(false)

  if (falhou) {
    return (
      <div
        className="mt-2 flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground"
        role="status"
      >
        <VideoOff className="size-4 shrink-0" aria-hidden />
        <span>Vídeo indisponível no momento.</span>
      </div>
    )
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border/70 bg-black">
      <video
        src={media.signedUrl}
        // Ver o cabeçalho: este atributo é o que impede a timeline de baixar
        // vídeo sozinha. Não trocar por "auto".
        preload="metadata"
        controls
        // `playsInline` é obrigatório no iOS: sem ele o Safari abre o player em
        // tela cheia nativa ao tocar play, tirando a pessoa da timeline. Com
        // ele, o vídeo toca no lugar, como em qualquer outro aparelho.
        playsInline
        onError={() => setFalhou(true)}
        className="block max-h-[70vh] w-full bg-black"
      />
    </div>
  )
}
