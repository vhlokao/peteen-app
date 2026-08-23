/**
 * Nome do bucket de mídia do Diário — compartilhado entre servidor e browser.
 *
 * POR QUE NÃO IMPORTAR DE lib/storage/care-media.ts: aquele arquivo é
 * `server-only` (abre conexão com Storage usando a service role). Importá-lo
 * de um Client Component quebraria o build — corretamente, aliás.
 *
 * POR QUE NÃO REESCREVER A STRING NO CLIENT: dois literais "care-media" em
 * lugares distintos divergem no dia em que o bucket for renomeado, e o sintoma
 * seria upload falhando só no browser. Uma constante, um lugar; o módulo
 * server-only passa a re-exportá-la em vez de declarar a sua.
 */
export const CARE_MEDIA_BUCKET_NAME = "care-media"

/**
 * Bucket de VÍDEO — separado do de foto por decisão de custo, não de domínio.
 *
 * `file_size_limit` no Supabase é por BUCKET, não por MIME. Um bucket único com
 * teto de 50 MB autorizaria FOTOS de 50 MB no upload: elas seriam rejeitadas
 * depois, na publicação (o teto de aplicação continua 5 MB), mas até lá já
 * teriam ocupado o bucket — e uma órfã custaria 10× mais.
 *
 * Com dois buckets, o `allowed_mime_types` de cada um impede FISICAMENTE vídeo
 * no bucket de foto e imagem no de vídeo, independentemente de qualquer bug de
 * aplicação. É a mesma garantia, movida para uma camada que o código não
 * consegue contornar por engano.
 *
 * `CareMedia` continua sendo a ÚNICA abstração de domínio: mesma tabela, mesmo
 * pipeline, mesma autorização. O que varia é só o destino físico.
 */
export const CARE_MEDIA_VIDEO_BUCKET_NAME = "care-media-video"

/**
 * Espelha `CareMediaType` do Prisma sem importá-lo: este módulo é consumido
 * pelo BROWSER (o upload direto precisa do nome do bucket), e arrastar o
 * client do Prisma para o bundle do cliente por um union de duas strings seria
 * caro e desnecessário. O teste de contrato garante que os dois não divirjam.
 */
export type CareMediaKind = "PHOTO" | "VIDEO"

export function bucketForCareMediaKind(kind: CareMediaKind): string {
  return kind === "VIDEO" ? CARE_MEDIA_VIDEO_BUCKET_NAME : CARE_MEDIA_BUCKET_NAME
}
