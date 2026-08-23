import "server-only"

/**
 * Helper isolado do bucket privado `care-media` (Care Operations V0 — R1).
 *
 * Nenhuma função aqui autoriza nada. Autorização de domínio ("é o profissional
 * desta request, IN_PROGRESS, sem disputa?") vive em
 * modules/care-timeline/application/care-media-authorization.ts e é
 * pré-requisito de toda chamada a este arquivo. A separação é proposital: um
 * helper de Storage que também decide permissão vira o lugar onde a regra é
 * duplicada e diverge.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UM CLIENTE PRÓPRIO, E NÃO createSupabaseServiceClient()
 *
 * `createSupabaseServiceClient()` (lib/supabase/server.ts) monta o cliente com
 * `createServerClient` do @supabase/ssr, passando os cookies da requisição.
 * O supabase-js resolve o header assim:
 *
 *     accessToken = (await getAccessToken()) ?? supabaseKey
 *
 * (verificado no fonte instalado, @supabase/supabase-js/dist/index.cjs)
 *
 * Ou seja: existindo sessão nos cookies, o JWT do USUÁRIO vence a service role
 * key no `Authorization`. O cliente pareceria privilegiado e agiria como o
 * usuário logado — que, neste bucket, não tem permissão nenhuma. O bug seria
 * silencioso e só apareceria como "403 inexplicável" em produção.
 *
 * Por isso aqui usamos `createClient` puro, SEM cookies e sem persistir
 * sessão: não há sessão para sobrepor a service role.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NENHUMA URL PÚBLICA. NUNCA.
 *
 * `getPublicUrl()` não é chamado em lugar nenhum deste arquivo e não deve ser
 * introduzido: o bucket é privado justamente para que o acesso seja sempre uma
 * capability curta e revogável por expiração, e não um link permanente.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import {
  buildCareMediaPath,
  isCareMediaRequestId,
  parseCareMediaPath,
  CARE_MEDIA_MAX_OBJECTS_PER_REQUEST,
  type CareAnyMimeType,
} from "./care-media-path"
import {
  careMediaDisplayTransform,
  careMediaThumbnailTransform,
  type CareMediaTransform,
} from "./care-media-transform"
import {
  bucketForCareMediaKind,
  CARE_MEDIA_BUCKET_NAME,
  type CareMediaKind,
} from "@/modules/care-timeline/domain/care-media-bucket"

/**
 * Importado, não declarado: o browser também precisa do nome do bucket para o
 * upload direto ao destino assinado (R2B.4), e este arquivo é `server-only`.
 * A fonte única vive em modules/care-timeline/domain/care-media-bucket.ts;
 * aqui ela é reexportada para não quebrar quem já importa daqui.
 *
 * Continua apontando para o bucket de FOTO: é o default histórico e o que os
 * chamadores antigos esperam. Quem lida com vídeo resolve o bucket por
 * `bucketForCareMediaKind(kind)`, nunca por esta constante.
 */
export const CARE_MEDIA_BUCKET = CARE_MEDIA_BUCKET_NAME

/**
 * Janela de vida da URL de LEITURA (1 h).
 *
 * Precisa cobrir com folga uma sessão de leitura do diário sem as imagens
 * quebrarem no meio. O retorno à aba já regenera as URLs (o
 * CareTimelineAutoRefresh re-renderiza o Server Component), então expirar não
 * deixa a tela num estado sem saída.
 */
export const CARE_MEDIA_READ_TTL_SECONDS = 60 * 60

/**
 * TTL da URL de UPLOAD: NÃO É CONFIGURÁVEL NESTA VERSÃO.
 *
 * `createSignedUploadUrl(path, options?)` aceita apenas `{ upsert }` no
 * @supabase/storage-js instalado — não existe `expiresIn`. O serviço fixa a
 * validade em 2 horas (documentado no próprio pacote: "valid for 2 hours").
 *
 * Registrado como risco aceito, não como decisão nossa: uma URL de escrita que
 * vaze permanece utilizável por até 2 h. O que limita o dano é o resto do
 * desenho — a URL autoriza UM path único, gerado no servidor, dentro de UMA
 * request já autorizada; não dá direito de leitura, de listagem, nem de
 * sobrescrever outro objeto (sem `upsert`, o path já ocupado é recusado).
 * Reduzir esta janela exigiria assinar o upload manualmente, fora do SDK.
 */
export const CARE_MEDIA_UPLOAD_TTL_SECONDS_FIXO_PELO_SERVICO = 2 * 60 * 60

/** Mensagem única para qualquer falha de Storage — nunca vaza bucket, path ou policy. */
export const CARE_MEDIA_STORAGE_FAILURE_MESSAGE =
  "Não foi possível preparar o envio da foto. Verifique sua conexão e tente novamente."

/**
 * Cliente com service role, sem cookies e sem sessão persistida.
 * Criado por chamada: é barato (só monta headers) e evita guardar credencial
 * privilegiada em módulo de longa duração.
 */
function createCareMediaStorageClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    // Erro de configuração, não de usuário — quem chama traduz para a mensagem
    // genérica acima. Nunca inclui o valor de nenhuma variável.
    throw new Error("care-media: Storage não configurado neste ambiente")
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Quantos objetos já existem sob o prefixo desta request.
 *
 * Único uso de `list()` neste helper, e escopado a um prefixo validado — não
 * abre listagem arbitrária do bucket. Serve ao freio de custo descrito em
 * CARE_MEDIA_MAX_OBJECTS_PER_REQUEST.
 *
 * O `limit` explícito é necessário: o default de `list()` é 100, e sem ele a
 * contagem seria truncada silenciosamente. Pedimos TETO+1 porque só precisamos
 * saber se o teto foi atingido, não o total exato.
 *
 * `null` = não foi possível contar (Storage fora, ambiente sem config,
 * requestId inválido). Quem chama decide o que fazer — ver a justificativa de
 * fail-open em care-media-authorization.ts.
 */
export async function countCareMediaObjectsForRequest(
  requestId: string
): Promise<number | null> {
  if (!isCareMediaRequestId(requestId)) return null

  try {
    const supabase = createCareMediaStorageClient()

    // Soma os DOIS buckets: o freio de custo é por REQUEST, não por bucket.
    // Contar só o de foto deixaria vídeo fora do teto — e vídeo é justamente
    // o que custa 10× mais por objeto.
    const buckets = [CARE_MEDIA_BUCKET_NAME, bucketForCareMediaKind("VIDEO")]
    let total = 0

    for (const bucket of buckets) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(`requests/${requestId}`, { limit: CARE_MEDIA_MAX_OBJECTS_PER_REQUEST + 1 })

      // Falha em QUALQUER bucket invalida a contagem inteira: um total parcial
      // seria menor que o real e deixaria passar quem já estourou o teto.
      // `null` aciona o fail-open documentado em care-media-authorization.ts —
      // decisão consciente, não omissão.
      if (error || !data) return null
      total += data.length
    }

    return total
  } catch (err) {
    console.error("[care-media] count_objects_failed", {
      erro: String(err).slice(0, 120),
    })
    return null
  }
}

export type CareMediaUploadTicket = {
  /**
   * Bucket de destino, resolvido no SERVIDOR por `bucketForCareMediaKind`.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * O INCIDENTE QUE ESTE CAMPO EXISTE PARA IMPEDIR
   *
   * O ticket carregava só `path`, e o cliente completava o destino com uma
   * constante — `care-media`, o bucket de foto. Enquanto só havia foto, a
   * constante acertava por coincidência. No primeiro upload real de vídeo o
   * servidor assinou para `care-media-video` e o cliente apresentou o token em
   * `care-media`: como a assinatura do Supabase cobre o bucket, a resposta foi
   * `Invalid signature` (400) e NENHUM byte chegou ao Storage.
   *
   * O bucket é tão parte do destino quanto o path. Ficar de fora do ticket
   * fazia o cliente escolher metade de um endereço que o protocolo diz que ele
   * nunca escolhe. Com o campo aqui, um tipo de mídia novo não tem como
   * reintroduzir a mesma classe de erro.
   */
  bucket: string
  /** Path relativo ao bucket. Necessário no protocolo: o cliente precisa dele
   *  para chamar uploadToSignedUrl e para devolvê-lo na publicação (R2), onde
   *  é RE-VALIDADO contra a request antes de virar linha. */
  path: string
  /** URL assinada de escrita, de vida curta. */
  signedUrl: string
  /** Token que acompanha a URL na API do Supabase. */
  token: string
}

/**
 * Emite uma autorização de upload para UM arquivo.
 *
 * O path é gerado AQUI, no servidor, a partir do requestId já autorizado e de
 * um UUID novo. O cliente nunca escolhe onde grava — só recebe o destino
 * pronto. Isso remove de vez a classe de ataque "informar um path de outra
 * request/bucket no momento do upload".
 *
 * PRÉ-REQUISITO: quem chama já provou, no domínio, que este usuário pode
 * publicar nesta request. Esta função não repete a checagem — ela não tem
 * como fazê-la corretamente.
 */
export async function createCareMediaUploadTicket(params: {
  requestId: string
  /** Foto ou vídeo — decide a EXTENSÃO do path. */
  mimeType: CareAnyMimeType
  /** Decide o BUCKET de destino. O path e a autorização são idênticos. */
  kind: CareMediaKind
}): Promise<CareMediaUploadTicket> {
  const path = buildCareMediaPath({
    requestId: params.requestId,
    fileId: crypto.randomUUID(),
    mimeType: params.mimeType,
  })

  const supabase = createCareMediaStorageClient()
  // Resolvido UMA vez e devolvido no ticket: assinar num bucket e devolver
  // outro é exatamente o bug que o campo `bucket` existe para impedir.
  const bucket = bucketForCareMediaKind(params.kind)
  // Sem `upsert`: o default (false) faz o Storage recusar um path já ocupado.
  // Como o path carrega um UUID novo a cada emissão, isso também impede que
  // uma URL reutilizada sobrescreva um arquivo já publicado.
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error("[care-media] upload_ticket_failed", {
      // Sem path e sem detalhe de policy: só o suficiente para diagnosticar.
      erro: String(error?.message ?? "sem data").slice(0, 120),
    })
    throw new Error(CARE_MEDIA_STORAGE_FAILURE_MESSAGE)
  }

  return { bucket, path, signedUrl: data.signedUrl, token: data.token }
}

/**
 * URL assinada de LEITURA para um path já persistido.
 *
 * PRÉ-REQUISITO: quem chama já verificou que o solicitante é participante da
 * request. Como reforço estrutural (defesa em profundidade, não substituto),
 * o path é re-validado contra o requestId — assim, mesmo um caller futuro que
 * esqueça a checagem de posse não consegue assinar mídia de outro atendimento.
 */
export async function createCareMediaReadUrl(params: {
  path: string
  requestId: string
  /** Default PHOTO: preserva o comportamento de todo chamador anterior. */
  kind?: CareMediaKind
  expiresInSeconds?: number
  /**
   * Redimensionamento aplicado na LEITURA. O objeto no bucket não é tocado —
   * o Storage deriva a renderização e a serve por CDN. Ausente = original.
   *
   * NUNCA use com vídeo: a transformação do Storage opera só em imagem e
   * devolveria uma URL que não reproduz. As funções de miniatura abaixo
   * recusam VIDEO explicitamente por isso.
   */
  transform?: CareMediaTransform
}): Promise<string | null> {
  const partes = parseCareMediaPath(params.path)
  if (!partes || partes.requestId !== params.requestId) {
    console.error("[care-media] read_url_path_mismatch")
    return null
  }

  const supabase = createCareMediaStorageClient()
  const { data, error } = await supabase.storage
    .from(bucketForCareMediaKind(params.kind ?? "PHOTO"))
    .createSignedUrl(
      params.path,
      params.expiresInSeconds ?? CARE_MEDIA_READ_TTL_SECONDS,
      params.transform ? { transform: params.transform } : undefined
    )

  if (error || !data) {
    console.error("[care-media] read_url_failed", {
      erro: String(error?.message ?? "sem data").slice(0, 120),
      // Distingue falha da miniatura (degradação aceitável — cai para a
      // original) de falha da original (a foto some da tela).
      variante: params.transform ? "thumbnail" : "original",
    })
    return null
  }

  return data.signedUrl
}

/**
 * URL assinada da MINIATURA usada na grade da timeline.
 *
 * Mesma autorização, mesmo bucket privado, mesma expiração da original — a
 * única diferença é o parâmetro de redimensionamento. Não existe caminho aqui
 * que produza URL pública, e a miniatura não é acessível por quem não poderia
 * ler a original: a assinatura é sobre o mesmo objeto.
 *
 * `null` (Storage instável, transformação indisponível no projeto) é
 * degradação PREVISTA, não erro: `resolveTimelineImageSrc` cai para a original
 * e a foto continua aparecendo — só pesada, como era antes.
 */
export async function createCareMediaThumbnailUrl(params: {
  path: string
  requestId: string
  expiresInSeconds?: number
}): Promise<string | null> {
  // Sem parâmetro `kind`: esta função é EXCLUSIVA de foto, por construção.
  // A transformação do Storage opera apenas em imagem; aplicada a um vídeo,
  // devolveria uma URL que não reproduz nada. Não aceitar o parâmetro é mais
  // forte que aceitá-lo e recusar VIDEO em runtime — o chamador nem consegue
  // expressar o pedido errado.
  return createCareMediaReadUrl({
    ...params,
    kind: "PHOTO",
    transform: careMediaThumbnailTransform(),
  })
}

/**
 * URL assinada da versao de VISUALIZACAO (1600px) usada pelo lightbox.
 *
 * Mesmas garantias da miniatura: mesmo objeto, mesma assinatura, mesmo bucket
 * privado.  faz o lightbox cair para a original — pesado, nunca ausente.
 */
export async function createCareMediaDisplayUrl(params: {
  path: string
  requestId: string
  expiresInSeconds?: number
}): Promise<string | null> {
  // Exclusiva de foto pelo mesmo motivo da miniatura — ver acima.
  return createCareMediaReadUrl({
    ...params,
    kind: "PHOTO",
    transform: careMediaDisplayTransform(),
  })
}

/**
 * Lê os primeiros bytes de um objeto já enviado, para validação por MAGIC BYTES.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO PRECISA EXISTIR
 *
 * Com upload DIRETO ao Storage (obrigatório: 3 fotos de 5 MB não cabem no
 * `bodySizeLimit: "6mb"` das Server Actions), o servidor nunca vê os bytes no
 * momento do upload. O `allowed_mime_types` do bucket confere apenas o
 * Content-Type DECLARADO pelo cliente — exatamente o que
 * pet-photo-signature.ts se recusa a tratar como prova.
 *
 * A validação real do conteúdo, então, só pode acontecer DEPOIS do upload e
 * ANTES da publicação: em R2, o passo de publicar lê estes bytes, roda o
 * detector de assinatura já existente e, se o conteúdo não for JPEG/PNG/WebP
 * de verdade, apaga o objeto e recusa a publicação. Sem esta função, o
 * contrato "magic bytes" ficaria só no papel para a mídia do Diário.
 */
export async function readCareMediaHeader(params: {
  path: string
  requestId: string
  bytes?: number
}): Promise<Uint8Array | null> {
  const objeto = await readCareMediaForValidation(params)
  return objeto?.header ?? null
}

/**
 * Lê header + TAMANHO REAL de um objeto já enviado, numa única ida ao Storage.
 *
 * O `sizeBytes` sai do próprio objeto baixado, jamais de um campo informado
 * pelo cliente: tamanho é entrada hostil tanto quanto o conteúdo, e é ele que
 * vai para `CareMedia.sizeBytes` e para a checagem do teto de 5 MB.
 *
 * `null` cobre TODA falha — path não pertence à request, objeto inexistente,
 * Storage indisponível ou ambiente sem configuração. O `try` externo existe
 * porque `createCareMediaStorageClient` LANÇA quando faltam as variáveis de
 * ambiente; sem ele o contrato "retorna null" seria mentira justamente no
 * caminho de erro (falha apontada na revisão de segurança do R1).
 *
 * CUSTO CONHECIDO: `download()` traz o objeto INTEIRO (até 5 MB) para ler 12
 * bytes de assinatura. É uma ida de rede por arquivo publicado, fora de
 * transação. Aceito no V0 em nome de uma leitura autoritativa e simples;
 * otimizável depois com `Range: bytes=0-11` sobre URL assinada, cujo
 * `Content-Range` também devolveria o tamanho total.
 */
export async function readCareMediaForValidation(params: {
  path: string
  requestId: string
  /** Default PHOTO: preserva o comportamento de todo chamador anterior. */
  kind?: CareMediaKind
  bytes?: number
}): Promise<{ header: Uint8Array; sizeBytes: number } | null> {
  const partes = parseCareMediaPath(params.path)
  if (!partes || partes.requestId !== params.requestId) return null

  try {
    const supabase = createCareMediaStorageClient()
    const { data, error } = await supabase.storage
      .from(bucketForCareMediaKind(params.kind ?? "PHOTO"))
      .download(params.path)

    if (error || !data) return null

    const sizeBytes = data.size
    const buffer = await data.slice(0, params.bytes ?? 12).arrayBuffer()
    return { header: new Uint8Array(buffer), sizeBytes }
  } catch (err) {
    console.error("[care-media] read_for_validation_failed", {
      erro: String(err).slice(0, 120),
    })
    return null
  }
}

/**
 * Lê os PRIMEIROS BYTES de um objeto sem baixá-lo inteiro, via `Range`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE EXISTE — E POR QUE SÓ AGORA
 *
 * `readCareMediaForValidation` usa `download()`, que traz o objeto INTEIRO para
 * ler alguns bytes de assinatura. O comentário daquela função já registrava o
 * custo como aceito para fotos de 5 MB e apontava esta otimização como a saída:
 *
 *   "otimizável depois com `Range: bytes=0-11` sobre URL assinada, cujo
 *    `Content-Range` também devolveria o tamanho total."
 *
 * Com vídeo de até 50 MB, "aceito" deixa de valer: seriam 50 MB baixados por
 * publicação, dentro do fluxo em que o profissional espera em pé durante um
 * atendimento. Aqui a otimização prevista é implementada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O TAMANHO VEM DO `Content-Range`, NÃO DO CLIENTE
 *
 * A resposta 206 traz `Content-Range: bytes 0-63/12345678` — o número após a
 * barra é o tamanho TOTAL do objeto, dito pelo Storage. É esse valor que vai
 * para a checagem de teto e para `CareMedia.sizeBytes`. `file.size` do browser
 * não participa de nada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FAIL CLOSED
 *
 * `null` em qualquer imprevisto — servidor ignorou o `Range` e devolveu 200,
 * `Content-Range` ausente ou malformado, tamanho não numérico, rede fora.
 * Quem chama trata `null` como "não consegui provar" e RECUSA. Em nenhum
 * caminho a falha desta função vira aceitação.
 */
export async function readCareMediaHeadBytes(params: {
  path: string
  requestId: string
  kind: CareMediaKind
  bytes: number
}): Promise<{ header: Uint8Array; sizeBytes: number } | null> {
  const partes = parseCareMediaPath(params.path)
  if (!partes || partes.requestId !== params.requestId) return null

  try {
    const supabase = createCareMediaStorageClient()
    const bucket = bucketForCareMediaKind(params.kind)

    // URL assinada curta: só o suficiente para o próprio servidor buscar o
    // trecho agora. Não vai para lugar nenhum além desta função.
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(params.path, 60)
    if (error || !data) return null

    const fim = params.bytes - 1
    const resposta = await fetch(data.signedUrl, {
      headers: { Range: `bytes=0-${fim}` },
    })

    // 206 é o ÚNICO sucesso aceitável. Um 200 significa que o Range foi
    // ignorado e o corpo é o arquivo inteiro — exatamente o que esta função
    // existe para evitar. Recusamos e deixamos o chamador decidir o fallback,
    // em vez de consumir 50 MB silenciosamente.
    if (resposta.status !== 206) {
      console.warn("[care-media] range_nao_suportado", { status: resposta.status })
      return null
    }

    // `bytes 0-63/12345678` → 12345678
    const contentRange = resposta.headers.get("content-range")
    const total = contentRange ? Number(contentRange.split("/")[1]) : NaN
    if (!Number.isFinite(total) || total <= 0) {
      console.warn("[care-media] content_range_invalido", {
        presente: contentRange !== null,
      })
      return null
    }

    const buffer = await resposta.arrayBuffer()
    return { header: new Uint8Array(buffer), sizeBytes: total }
  } catch (err) {
    console.error("[care-media] range_read_failed", { erro: String(err).slice(0, 120) })
    return null
  }
}

/**
 * Remove um objeto do bucket. Best-effort — nunca lança.
 *
 * Usos previstos (R2): descartar arquivo reprovado na validação de magic bytes
 * e limpar órfãos. Ver o contrato de órfãos em docs/care-media-orphans.md.
 */
export async function deleteCareMediaObject(params: {
  path: string
  requestId: string
  /** Default PHOTO: preserva o comportamento de todo chamador anterior. */
  kind?: CareMediaKind
}): Promise<boolean> {
  const partes = parseCareMediaPath(params.path)
  if (!partes || partes.requestId !== params.requestId) return false

  try {
    const supabase = createCareMediaStorageClient()
    const { error } = await supabase.storage
      .from(bucketForCareMediaKind(params.kind ?? "PHOTO"))
      .remove([params.path])
    return !error
  } catch (err) {
    console.error("[care-media] delete_failed", { erro: String(err).slice(0, 120) })
    return false
  }
}
