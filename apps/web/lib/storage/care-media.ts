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
  type CareMediaMimeType,
} from "./care-media-path"
import { careMediaThumbnailTransform, type CareMediaTransform } from "./care-media-transform"
import { CARE_MEDIA_BUCKET_NAME } from "@/modules/care-timeline/domain/care-media-bucket"

/**
 * Importado, não declarado: o browser também precisa do nome do bucket para o
 * upload direto ao destino assinado (R2B.4), e este arquivo é `server-only`.
 * A fonte única vive em modules/care-timeline/domain/care-media-bucket.ts;
 * aqui ela é reexportada para não quebrar quem já importa daqui.
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
    const { data, error } = await supabase.storage
      .from(CARE_MEDIA_BUCKET)
      .list(`requests/${requestId}`, { limit: CARE_MEDIA_MAX_OBJECTS_PER_REQUEST + 1 })

    if (error || !data) return null
    return data.length
  } catch (err) {
    console.error("[care-media] count_objects_failed", {
      erro: String(err).slice(0, 120),
    })
    return null
  }
}

export type CareMediaUploadTicket = {
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
  mimeType: CareMediaMimeType
}): Promise<CareMediaUploadTicket> {
  const path = buildCareMediaPath({
    requestId: params.requestId,
    fileId: crypto.randomUUID(),
    mimeType: params.mimeType,
  })

  const supabase = createCareMediaStorageClient()
  // Sem `upsert`: o default (false) faz o Storage recusar um path já ocupado.
  // Como o path carrega um UUID novo a cada emissão, isso também impede que
  // uma URL reutilizada sobrescreva um arquivo já publicado.
  const { data, error } = await supabase.storage
    .from(CARE_MEDIA_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error("[care-media] upload_ticket_failed", {
      // Sem path e sem detalhe de policy: só o suficiente para diagnosticar.
      erro: String(error?.message ?? "sem data").slice(0, 120),
    })
    throw new Error(CARE_MEDIA_STORAGE_FAILURE_MESSAGE)
  }

  return { path, signedUrl: data.signedUrl, token: data.token }
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
  expiresInSeconds?: number
  /**
   * Redimensionamento aplicado na LEITURA. O objeto no bucket não é tocado —
   * o Storage deriva a renderização e a serve por CDN. Ausente = original.
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
    .from(CARE_MEDIA_BUCKET)
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
  return createCareMediaReadUrl({ ...params, transform: careMediaThumbnailTransform() })
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
  bytes?: number
}): Promise<{ header: Uint8Array; sizeBytes: number } | null> {
  const partes = parseCareMediaPath(params.path)
  if (!partes || partes.requestId !== params.requestId) return null

  try {
    const supabase = createCareMediaStorageClient()
    const { data, error } = await supabase.storage.from(CARE_MEDIA_BUCKET).download(params.path)

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
 * Remove um objeto do bucket. Best-effort — nunca lança.
 *
 * Usos previstos (R2): descartar arquivo reprovado na validação de magic bytes
 * e limpar órfãos. Ver o contrato de órfãos em docs/care-media-orphans.md.
 */
export async function deleteCareMediaObject(params: {
  path: string
  requestId: string
}): Promise<boolean> {
  const partes = parseCareMediaPath(params.path)
  if (!partes || partes.requestId !== params.requestId) return false

  try {
    const supabase = createCareMediaStorageClient()
    const { error } = await supabase.storage.from(CARE_MEDIA_BUCKET).remove([params.path])
    return !error
  } catch (err) {
    console.error("[care-media] delete_failed", { erro: String(err).slice(0, 120) })
    return false
  }
}
