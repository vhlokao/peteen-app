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
 *   - onde grava        → o path vem do ticket, gerado no servidor
 *   - se o byte presta  → validateMediaPaths (servidor, magic bytes)
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
import { CARE_MEDIA_BUCKET_NAME } from "../domain/care-media-bucket"

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
  ticket: { path: string; token: string }
  mimeTypeAutorizado: string
  mensagemDeFalha: string
}): Promise<UploadOutcome> {
  const { file, ticket, mimeTypeAutorizado, mensagemDeFalha } = params

  try {
    const bytes = await file.arrayBuffer()
    const corpo = new Blob([bytes], { type: mimeTypeAutorizado })

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.storage
      .from(CARE_MEDIA_BUCKET_NAME)
      .uploadToSignedUrl(ticket.path, ticket.token, corpo, {
        contentType: mimeTypeAutorizado,
      })

    if (error) {
      // O erro do Storage pode conter path e detalhes de infraestrutura —
      // fica no console para diagnóstico, nunca na tela.
      console.error("[care-media] upload_failed", {
        erro: String(error.message ?? error).slice(0, 120),
      })
      return { ok: false, message: mensagemDeFalha }
    }

    return { ok: true, path: ticket.path }
  } catch (err) {
    console.error("[care-media] upload_threw", { erro: String(err).slice(0, 120) })
    return { ok: false, message: mensagemDeFalha }
  }
}
