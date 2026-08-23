"use client"

/**
 * Módulo: care-timeline
 * Camada: infrastructure (browser) — envio de UMA foto ao bucket privado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE O BYTE NÃO PASSA PELA SERVER ACTION
 *
 * Uma Server Action serializa o corpo inteiro na requisição do Next: 3 fotos de
 * 5 MB virariam 15 MB atravessando o runtime do servidor antes de chegar ao
 * Storage — com limite de body, memória e timeout no caminho. O protocolo
 * correto (definido em R2A) é: o servidor autoriza e devolve um destino
 * assinado; o browser envia direto ao bucket; o servidor depois VERIFICA os
 * bytes que chegaram lá.
 *
 * Esta função é só a perna do meio. Ela não decide nada:
 *   - quem pode enviar  → authorizeCareMediaUpload (servidor)
 *   - onde grava        → bucket E path vêm do ticket, gerados no servidor
 *   - se o byte presta  → validateMediaPaths (servidor, magic bytes)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * "ONDE GRAVA" INCLUI O BUCKET — LIÇÃO DO PRIMEIRO UPLOAD REAL DE VÍDEO
 *
 * Este arquivo já dizia que o destino vem do servidor, mas completava o
 * endereço com uma constante local, `care-media`. Com só foto no sistema a
 * constante acertava por coincidência. No primeiro vídeo real o servidor
 * assinou para `care-media-video`, o cliente apresentou o token em
 * `care-media`, e o Storage respondeu `Invalid signature` (400) — nenhum byte
 * gravado, nenhum órfão, e uma mensagem de erro que não dizia o que houve.
 *
 * O bucket agora vem do ticket, junto com o path. Não há fallback: um ticket
 * sem bucket é um ticket que não sabemos honrar, e adivinhar o destino é
 * justamente o que quebrou.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O DETALHE QUE JÁ QUEBROU EM PRODUÇÃO NESTE PROJETO
 *
 * O SDK do Supabase serializa File/Blob como multipart/form-data, e nesse
 * formato o Content-Type de cada parte vem do PRÓPRIO Blob — não da opção
 * `contentType`. Em mobile é comum `file.type` chegar vazio; o multipart
 * declararia "application/octet-stream" e o bucket recusaria mesmo com
 * `contentType` correto na chamada. Por isso reconstruímos o Blob com o tipo
 * que o servidor autorizou. Mesma lição já documentada em lib/storage/pet-photo.ts.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export type UploadOutcome =
  | { ok: true; path: string }
  /** Mensagem já humana — o componente exibe direto, sem traduzir código. */
  | { ok: false; message: string }

/**
 * Envia o arquivo para o destino assinado do ticket.
 *
 * `mimeTypeAutorizado` é o tipo que o SERVIDOR aceitou ao emitir o ticket —
 * usá-lo (em vez de `file.type`) mantém o Blob coerente com a autorização.
 */
export async function uploadCareMediaToTicket(params: {
  file: File
  ticket: { bucket: string; path: string; token: string }
  mimeTypeAutorizado: string
  mensagemDeFalha: string
  /** Só para log — separa foto de vídeo no diagnóstico. Nunca vai à tela. */
  kind?: "PHOTO" | "VIDEO"
}): Promise<UploadOutcome> {
  const { file, ticket, mimeTypeAutorizado, mensagemDeFalha, kind } = params

  // FAIL CLOSED: sem bucket não há destino conhecido. Cair para `care-media`
  // aqui reintroduziria o bug — silenciosamente, e só para vídeo.
  if (!ticket.bucket) {
    console.error("[care-media] upload_sem_bucket", { kind: kind ?? "?" })
    return { ok: false, message: mensagemDeFalha }
  }

  try {
    const bytes = await file.arrayBuffer()
    const corpo = new Blob([bytes], { type: mimeTypeAutorizado })

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, corpo, {
        contentType: mimeTypeAutorizado,
      })

    if (error) {
      // `kind` e `bucket` são o que faltava para diagnosticar o incidente do
      // primeiro vídeo em segundos. `token`, `signedUrl` e `path` ficam FORA:
      // o token é credencial de escrita, e o path identifica a request.
      console.error("[care-media] upload_failed", {
        kind: kind ?? "?",
        bucket: ticket.bucket,
        erro: String(error.message ?? error).slice(0, 120),
      })
      return { ok: false, message: mensagemDeFalha }
    }

    return { ok: true, path: ticket.path }
  } catch (err) {
    console.error("[care-media] upload_threw", {
      kind: kind ?? "?",
      bucket: ticket.bucket,
      erro: String(err).slice(0, 120),
    })
    return { ok: false, message: mensagemDeFalha }
  }
}
