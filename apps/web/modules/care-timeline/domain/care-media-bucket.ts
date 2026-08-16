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
